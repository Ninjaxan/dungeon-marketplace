const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

// Ensure data directory exists before db.js runs
fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });

const marketplaceRouter = require('./marketplace');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Marketplace routes ───────────────────────────────────────────────────
app.use('/marketplace', marketplaceRouter);

// ── Health ────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => {
    const db = require('./db');
    const mintCount = db.prepare('SELECT COUNT(*) as n FROM nft_mints').get()?.n ?? 0;
    res.json({ status: 'ok', service: 'dungeon-marketplace', mints: mintCount });
});

// ── Settlement service (optional) ─────────────────────────────────────
if (process.env.ENABLE_SETTLEMENT === 'true') {
    const { startSettlementService } = require('./settlement');
    startSettlementService();
}

// ── Manual settlement endpoint ────────────────────────────────────────
const { settleAuction } = require('./settlement');
app.post('/marketplace/settle/:listingId', async (req, res) => {
    try {
        const txHash = await settleAuction(req.params.listingId);
        res.json({ ok: true, txHash });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`[Marketplace API] Listening on port ${PORT}`));
