const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'marketplace.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS nft_mints (
    token_id       TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    nft_contract   TEXT NOT NULL,
    asset_type     TEXT NOT NULL,
    asset_id       TEXT NOT NULL,
    ipfs_metadata  TEXT NOT NULL DEFAULT '',
    ipfs_image     TEXT NOT NULL DEFAULT '',
    tx_hash        TEXT,
    minted_at      INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_nft_wallet ON nft_mints(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_nft_asset  ON nft_mints(asset_type, asset_id);

  CREATE TABLE IF NOT EXISTS listing_cache (
    listing_id     TEXT PRIMARY KEY,
    seller         TEXT NOT NULL,
    nft_contract   TEXT NOT NULL,
    token_id       TEXT NOT NULL,
    listing_type   TEXT NOT NULL DEFAULT 'fixed',
    price          TEXT NOT NULL DEFAULT '0',
    current_bid    TEXT NOT NULL DEFAULT '0',
    expires_at     INTEGER NOT NULL DEFAULT 0,
    is_active      INTEGER NOT NULL DEFAULT 1,
    nft_name       TEXT NOT NULL DEFAULT '',
    nft_image      TEXT NOT NULL DEFAULT '',
    asset_type     TEXT NOT NULL DEFAULT '',
    cached_at      INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_listing_seller ON listing_cache(seller);
  CREATE INDEX IF NOT EXISTS idx_listing_active ON listing_cache(is_active);
`);

console.log(`[DB] SQLite ready at ${DB_PATH}`);

module.exports = db;
