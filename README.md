# Dungeon Marketplace

NFT Marketplace for Dungeon Chain — buy and sell Heroes and Gear as tradeable NFTs.

## Architecture

```
contracts/     CosmWasm smart contracts (CW721 + Marketplace)
api/           Marketplace backend API (Node.js/Express)
web/           Marketplace frontend (Next.js)
```

## Quick Start

### 1. Deploy Contracts

```bash
cd contracts
./deploy.sh
```

### 2. Run API

```bash
cd api
cp .env.example .env   # Fill in contract addresses + Pinata JWT
npm install
npm run dev
```

### 3. Run Web

```bash
cd web
cp .env.local.example .env.local   # Fill in contract addresses
npm install
npm run dev
```

## Smart Contracts

- **cw721-dungeon**: CW721 NFT with custom `DungeonNftExtension` metadata (hero/gear traits)
- **marketplace**: Listings, fixed-price buys, auction bids, 5% treasury royalty

## Tech Stack

- **Contracts**: Rust / CosmWasm 1.5
- **API**: Node.js, Express, better-sqlite3, @cosmjs
- **Web**: Next.js 16, React 19, Tailwind CSS 4, @cosmjs
- **IPFS**: Pinata
- **Chain**: Dungeon Chain (Cosmos SDK)
