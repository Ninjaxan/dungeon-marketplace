const express = require('express');
const { SigningCosmWasmClient } = require('@cosmjs/cosmwasm-stargate');
const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
const { GasPrice } = require('@cosmjs/stargate');
const db = require('./db');
const { requireAuth } = require('./auth');
const { uploadImage, uploadMetadata, resolveIpfsUrl } = require('./ipfs');

const router = express.Router();

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

// GET /marketplace/listings — Browse marketplace listings
router.get('/listings', async (req, res) => {
    try {
        const { contract, seller, start_after, limit } = req.query;
        const listings = await queryListings({
            nftContract: contract,
            seller,
            startAfter: start_after,
            limit: limit ? parseInt(limit, 10) : 20,
        });
        return res.json({ ok: true, listings });
    } catch (err) {
        console.error('[Marketplace] Listings error:', err.message);
        return res.status(500).json({ ok: false, error: err.message });
    }
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
