const express = require('express');
const { SigningCosmWasmClient } = require('@cosmjs/cosmwasm-stargate');
const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
const { GasPrice } = require('@cosmjs/stargate');
const db = require('./db');
const { requireAuth } = require('./auth');
const { uploadImage, uploadMetadata, resolveIpfsUrl } = require('./ipfs');

const router = express.Router();

// ── Rate limiter (in-memory, 30 req/min per IP) ────────────────────────────

const _rateMap = new Map();
function isRateLimited(ip) {
    const now = Date.now();
    let entry = _rateMap.get(ip);
    if (!entry || now - entry.start > 60000) {
        entry = { count: 0, start: now };
        _rateMap.set(ip, entry);
    }
    entry.count++;
    return entry.count > 30;
}

// ── Listing cache helpers ──────────────────────────────────────────────────

const CACHE_TTL_SEC = 60;

const cacheStmts = {
    getMaxAge: db.prepare('SELECT MAX(cached_at) as max_at FROM listing_cache'),
    getAll: db.prepare('SELECT * FROM listing_cache WHERE is_active = 1 ORDER BY listing_id DESC LIMIT ? OFFSET ?'),
    upsert: db.prepare(`INSERT OR REPLACE INTO listing_cache
        (listing_id, seller, nft_contract, token_id, listing_type, price, current_bid, expires_at, is_active, nft_name, nft_image, asset_type, cached_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    invalidate: db.prepare('UPDATE listing_cache SET is_active = 0 WHERE listing_id = ?'),
    purge: db.prepare('DELETE FROM listing_cache'),
};

const refreshCache = db.transaction((listings) => {
    const now = Math.floor(Date.now() / 1000);
    for (const l of listings) {
        cacheStmts.upsert.run(
            String(l.listing_id), l.seller, l.nft_contract, l.token_id,
            l.listing_type || 'fixed', l.price || '0', l.current_bid || '0',
            l.expires_at || 0, l.is_active ? 1 : 0,
            l.nft_name || '', l.nft_image || '', l.asset_type || '', now
        );
    }
});

function isCacheFresh() {
    const row = cacheStmts.getMaxAge.get();
    if (!row || !row.max_at) return false;
    return (Math.floor(Date.now() / 1000) - row.max_at) < CACHE_TTL_SEC;
}

// ── Env ─────────────────────────────────────────────────────────────────────

const HOT_WALLET_MNEMONIC  = process.env.HOT_WALLET_MNEMONIC || '';
const HERO_NFT_CONTRACT    = process.env.HERO_NFT_CONTRACT || '';
const GEAR_NFT_CONTRACT    = process.env.GEAR_NFT_CONTRACT || '';
const MARKETPLACE_CONTRACT = process.env.MARKETPLACE_CONTRACT || '';
const RPC_URL              = process.env.RPC_URL || 'https://rpc.dungeonchain.xyz';

// ── CosmWasm client (lazy singleton, shared with nft.js pattern) ────────────

let _client = null;
let _senderAddress = null;

async function getClient() {
    if (_client) return { client: _client, sender: _senderAddress };

    if (!HOT_WALLET_MNEMONIC) throw new Error('HOT_WALLET_MNEMONIC not configured');

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(HOT_WALLET_MNEMONIC, {
        prefix: 'dungeon',
    });
    const [account] = await wallet.getAccounts();
    _senderAddress = account.address;

    _client = await SigningCosmWasmClient.connectWithSigner(RPC_URL, wallet, {
        gasPrice: GasPrice.fromString('0.025udgn'),
    });

    console.log(`[Marketplace] CosmWasm client ready. Sender: ${_senderAddress}`);
    return { client: _client, sender: _senderAddress };
}

// ── Hero NFT metadata builder ───────────────────────────────────────────────

function buildHeroMetadata(hero, imageUri) {
    return {
        name: hero.displayName || hero.dataId || 'Unknown Hero',
        description: `A ${hero.rarity || 'Common'} ${hero.heroClass || 'Warrior'} hero from Kosmic Dungeon.`,
        image: imageUri || '',
        asset_type: 'hero',
        attributes: [
            { trait_type: 'Class',          value: String(hero.heroClass || 'Warrior') },
            { trait_type: 'Rarity',         value: String(hero.rarity || 'Common') },
            { trait_type: 'Level',          value: String(hero.level || 1) },
            { trait_type: 'Star Rank',      value: String(hero.starRank || 1) },
            { trait_type: 'Ascension Tier', value: String(hero.ascensionTier || 0) },
            { trait_type: 'Race',           value: String(hero.raceId || 'human') },
            { trait_type: 'Gender',         value: String(hero.gender || 'male') },
        ],
    };
}

// ── Gear NFT metadata builder ───────────────────────────────────────────────

function buildGearMetadata(gear, imageUri) {
    return {
        name: gear.gearName || gear.gearDataId || 'Unknown Gear',
        description: `A ${gear.rarity || 'Common'} ${gear.slot || 'equipment'} from Kosmic Dungeon.`,
        image: imageUri || '',
        asset_type: 'gear',
        attributes: [
            { trait_type: 'Slot',           value: String(gear.slot || '') },
            { trait_type: 'Rarity',         value: String(gear.rarity || 'Common') },
            { trait_type: 'Set',            value: String(gear.setId || 'None') },
            { trait_type: 'Enhance Level',  value: String(gear.enhanceLevel || 0) },
            { trait_type: 'Bonus Attack',   value: String(gear.bonusAttack || 0) },
            { trait_type: 'Bonus Defense',  value: String(gear.bonusDefense || 0) },
            { trait_type: 'Bonus Health',   value: String(gear.bonusHealth || 0) },
            { trait_type: 'Socket Gems',    value: JSON.stringify(gear.socketGems || [-1, -1, -1]) },
        ],
    };
}

// ── Mint Hero NFT ───────────────────────────────────────────────────────────

async function mintHeroNft(walletAddress, hero, imageIpfsUri) {
    if (!HERO_NFT_CONTRACT) throw new Error('HERO_NFT_CONTRACT not configured');

    const { client, sender } = await getClient();
    const extension = buildHeroMetadata(hero, imageIpfsUri);

    // Upload metadata to IPFS
    const tokenUri = await uploadMetadata(extension);

    const tokenId = `hero_${hero.dataId}_${walletAddress.slice(-8)}`;

    const msg = {
        base: {
            mint: {
                token_id: tokenId,
                owner: walletAddress,
                token_uri: tokenUri,
                extension,
            },
        },
    };

    const result = await client.execute(sender, HERO_NFT_CONTRACT, msg, 'auto', 'Mint Dungeon Hero NFT');
    console.log(`[Marketplace] Minted hero NFT ${tokenId} tx=${result.transactionHash}`);

    // Record in DB
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`INSERT OR REPLACE INTO nft_mints (token_id, wallet_address, nft_contract, asset_type, asset_id, ipfs_metadata, ipfs_image, tx_hash, minted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(tokenId, walletAddress, HERO_NFT_CONTRACT, 'hero', hero.dataId, tokenUri, imageIpfsUri || '', result.transactionHash, now);

    return { tokenId, txHash: result.transactionHash, tokenUri };
}

// ── Mint Gear NFT ───────────────────────────────────────────────────────────

async function mintGearNft(walletAddress, gear, imageIpfsUri) {
    if (!GEAR_NFT_CONTRACT) throw new Error('GEAR_NFT_CONTRACT not configured');

    const { client, sender } = await getClient();
    const extension = buildGearMetadata(gear, imageIpfsUri);

    const tokenUri = await uploadMetadata(extension);
    const tokenId = `gear_${gear.instanceId}`;

    const msg = {
        base: {
            mint: {
                token_id: tokenId,
                owner: walletAddress,
                token_uri: tokenUri,
                extension,
            },
        },
    };

    const result = await client.execute(sender, GEAR_NFT_CONTRACT, msg, 'auto', 'Mint Dungeon Gear NFT');
    console.log(`[Marketplace] Minted gear NFT ${tokenId} tx=${result.transactionHash}`);

    const now = Math.floor(Date.now() / 1000);
    db.prepare(`INSERT OR REPLACE INTO nft_mints (token_id, wallet_address, nft_contract, asset_type, asset_id, ipfs_metadata, ipfs_image, tx_hash, minted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(tokenId, walletAddress, GEAR_NFT_CONTRACT, 'gear', gear.instanceId, tokenUri, imageIpfsUri || '', result.transactionHash, now);

    return { tokenId, txHash: result.transactionHash, tokenUri };
}

// ── Update Hero NFT metadata ────────────────────────────────────────────────

async function updateHeroNft(tokenId, hero) {
    if (!HERO_NFT_CONTRACT) throw new Error('HERO_NFT_CONTRACT not configured');

    const { client, sender } = await getClient();
    const extension = buildHeroMetadata(hero, hero.imageUri || '');

    const msg = {
        update_metadata: {
            token_id: tokenId,
            extension,
        },
    };

    const result = await client.execute(sender, HERO_NFT_CONTRACT, msg, 'auto', 'Update Hero NFT metadata');
    console.log(`[Marketplace] Updated hero NFT ${tokenId} tx=${result.transactionHash}`);
    return { txHash: result.transactionHash };
}

// ── Update Gear NFT metadata ────────────────────────────────────────────────

async function updateGearNft(tokenId, gear) {
    if (!GEAR_NFT_CONTRACT) throw new Error('GEAR_NFT_CONTRACT not configured');

    const { client, sender } = await getClient();
    const extension = buildGearMetadata(gear, gear.imageUri || '');

    const msg = {
        update_metadata: {
            token_id: tokenId,
            extension,
        },
    };

    const result = await client.execute(sender, GEAR_NFT_CONTRACT, msg, 'auto', 'Update Gear NFT metadata');
    console.log(`[Marketplace] Updated gear NFT ${tokenId} tx=${result.transactionHash}`);
    return { txHash: result.transactionHash };
}

// ── Query marketplace listings ──────────────────────────────────────────────

async function queryListings(filters = {}) {
    const { client } = await getClient();

    const query = filters.nftContract
        ? { listings_by_contract: { nft_contract: filters.nftContract, start_after: filters.startAfter, limit: filters.limit || 20 } }
        : filters.seller
            ? { listings_by_seller: { seller: filters.seller, start_after: filters.startAfter, limit: filters.limit || 20 } }
            : { all_listings: { start_after: filters.startAfter, limit: filters.limit || 20 } };

    const result = await client.queryContractSmart(MARKETPLACE_CONTRACT, query);
    return result.listings || [];
}

// ── Query NFT info ──────────────────────────────────────────────────────────

async function queryNftInfo(contract, tokenId) {
    const { client } = await getClient();
    return client.queryContractSmart(contract, { nft_info: { token_id: tokenId } });
}

// ── Prepared statements ─────────────────────────────────────────────────────

const stmts = {
    myNfts: db.prepare('SELECT * FROM nft_mints WHERE wallet_address = ? ORDER BY minted_at DESC'),
    nftByToken: db.prepare('SELECT * FROM nft_mints WHERE token_id = ?'),
    nftByAsset: db.prepare('SELECT * FROM nft_mints WHERE asset_type = ? AND asset_id = ?'),
};

// ── Routes ──────────────────────────────────────────────────────────────────

// POST /marketplace/mint-hero — Mint a hero as NFT
router.post('/mint-hero', requireAuth, async (req, res) => {
    try {
        const { hero, imageUri } = req.body;
        if (!hero || !hero.dataId) {
            return res.status(400).json({ ok: false, error: 'Missing hero data' });
        }

        // Check if already minted
        const existing = stmts.nftByAsset.get('hero', hero.dataId);
        if (existing) {
            return res.json({ ok: true, tokenId: existing.token_id, alreadyMinted: true });
        }

        const result = await mintHeroNft(req.walletAddress, hero, imageUri || '');
        return res.json({ ok: true, ...result });
    } catch (err) {
        console.error('[Marketplace] Mint hero error:', err.message);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

// POST /marketplace/mint-gear — Mint gear as NFT
router.post('/mint-gear', requireAuth, async (req, res) => {
    try {
        const { gear, imageUri } = req.body;
        if (!gear || !gear.instanceId) {
            return res.status(400).json({ ok: false, error: 'Missing gear data' });
        }

        const existing = stmts.nftByAsset.get('gear', gear.instanceId);
        if (existing) {
            return res.json({ ok: true, tokenId: existing.token_id, alreadyMinted: true });
        }

        const result = await mintGearNft(req.walletAddress, gear, imageUri || '');
        return res.json({ ok: true, ...result });
    } catch (err) {
        console.error('[Marketplace] Mint gear error:', err.message);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

// GET /marketplace/listings — Browse marketplace listings (cached + rate-limited)
router.get('/listings', async (req, res) => {
    if (isRateLimited(req.ip)) {
        return res.status(429).json({ ok: false, error: 'Too many requests. Try again in a minute.' });
    }

    try {
        const { contract, seller, start_after } = req.query;
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
        const offset = parseInt(req.query.offset, 10) || 0;

        // For filtered queries (by contract/seller), skip cache and go to chain
        if (contract || seller) {
            const listings = await queryListings({
                nftContract: contract,
                seller,
                startAfter: start_after,
                limit,
            });
            return res.json({ ok: true, listings });
        }

        // For unfiltered "all listings", use cache
        if (isCacheFresh()) {
            const cached = cacheStmts.getAll.all(limit, offset);
            return res.json({ ok: true, listings: cached, cached: true });
        }

        // Cache stale — refresh from chain
        const listings = await queryListings({ limit: 100 });
        refreshCache(listings);
        const page = cacheStmts.getAll.all(limit, offset);
        return res.json({ ok: true, listings: page, cached: false });
    } catch (err) {
        console.error('[Marketplace] Listings error:', err.message);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

// DELETE /marketplace/cache — Force invalidate listing cache
router.delete('/cache', (req, res) => {
    cacheStmts.purge.run();
    return res.json({ ok: true });
});

// GET /marketplace/my-nfts — List user's minted NFTs
router.get('/my-nfts', requireAuth, (req, res) => {
    const nfts = stmts.myNfts.all(req.walletAddress);
    return res.json({
        ok: true,
        nfts: nfts.map(r => ({
            tokenId: r.token_id,
            nftContract: r.nft_contract,
            assetType: r.asset_type,
            assetId: r.asset_id,
            ipfsMetadata: r.ipfs_metadata,
            ipfsImage: r.ipfs_image,
            txHash: r.tx_hash,
            mintedAt: r.minted_at,
        })),
    });
});

// GET /marketplace/nft/:tokenId — Get single NFT info
router.get('/nft/:tokenId', async (req, res) => {
    try {
        const record = stmts.nftByToken.get(req.params.tokenId);
        if (!record) {
            return res.status(404).json({ ok: false, error: 'NFT not found' });
        }
        return res.json({
            ok: true,
            nft: {
                tokenId: record.token_id,
                nftContract: record.nft_contract,
                assetType: record.asset_type,
                assetId: record.asset_id,
                ipfsMetadata: record.ipfs_metadata,
                ipfsImage: record.ipfs_image,
                txHash: record.tx_hash,
                mintedAt: record.minted_at,
            },
        });
    } catch (err) {
        console.error('[Marketplace] NFT query error:', err.message);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
