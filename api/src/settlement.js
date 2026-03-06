const { SigningCosmWasmClient } = require('@cosmjs/cosmwasm-stargate');
const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
const { GasPrice } = require('@cosmjs/stargate');

const MARKETPLACE_CONTRACT = process.env.MARKETPLACE_CONTRACT || '';
const RPC_URL = process.env.RPC_URL || 'https://rpc.dungeonchain.xyz';
const HOT_WALLET_MNEMONIC = process.env.HOT_WALLET_MNEMONIC || '';
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let _client = null;
let _sender = null;

async function getSettlementClient() {
    if (_client) return { client: _client, sender: _sender };

    if (!HOT_WALLET_MNEMONIC) throw new Error('HOT_WALLET_MNEMONIC not configured');

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(HOT_WALLET_MNEMONIC, {
        prefix: 'dungeon',
    });
    const [account] = await wallet.getAccounts();
    _sender = account.address;

    _client = await SigningCosmWasmClient.connectWithSigner(RPC_URL, wallet, {
        gasPrice: GasPrice.fromString('0.025udgn'),
    });

    return { client: _client, sender: _sender };
}

async function settleAuction(listingId) {
    const { client, sender } = await getSettlementClient();
    const msg = { settle_auction: { listing_id: parseInt(listingId, 10) } };
    const result = await client.execute(sender, MARKETPLACE_CONTRACT, msg, 'auto', 'Settle auction');
    return result.transactionHash;
}

async function runSettlementCycle() {
    if (!MARKETPLACE_CONTRACT) return;

    try {
        const { client } = await getSettlementClient();
        const nowSec = Math.floor(Date.now() / 1000);

        // Query active listings
        const result = await client.queryContractSmart(MARKETPLACE_CONTRACT, {
            all_listings: { limit: 50 },
        });

        const listings = result.listings || [];
        const expired = listings.filter(
            (l) => l.is_active && l.listing_type === 'Auction' && l.expires_at > 0 && l.expires_at <= nowSec
        );

        if (expired.length === 0) return;

        console.log(`[Settlement] Found ${expired.length} expired auction(s) to settle`);

        for (const listing of expired) {
            try {
                const txHash = await settleAuction(listing.listing_id);
                console.log(`[Settlement] Settled listing #${listing.listing_id} tx=${txHash}`);
            } catch (err) {
                console.error(`[Settlement] Failed to settle #${listing.listing_id}: ${err.message}`);
            }
        }
    } catch (err) {
        console.error(`[Settlement] Cycle error: ${err.message}`);
    }
}

function startSettlementService() {
    console.log('[Settlement] Service started (interval: 5min)');
    // Run immediately, then every 5 minutes
    runSettlementCycle();
    setInterval(runSettlementCycle, INTERVAL_MS);
}

module.exports = { startSettlementService, settleAuction };
