#!/usr/bin/env node
/**
 * Deploy CW721 + Marketplace contracts to Dungeon Chain using CosmJS.
 *
 * Usage:
 *   1. Download compiled WASM from GitHub Actions artifacts
 *   2. Place cw721_dungeon.wasm and dungeon_marketplace.wasm in scripts/artifacts/
 *   3. Set HOT_WALLET_MNEMONIC env var (or create .env in project root)
 *   4. Run: node scripts/deploy-contracts.js
 */

const fs = require("fs");
const path = require("path");
const {
  SigningCosmWasmClient,
} = require("@cosmjs/cosmwasm-stargate");
const { DirectSecp256k1HdWallet } = require("@cosmjs/proto-signing");
const { GasPrice } = require("@cosmjs/stargate");

// ---------- Config ----------
const RPC_URL = process.env.RPC_URL || "https://rpc.cosmos.directory/dungeon";
const CHAIN_PREFIX = "dungeon";
const DENOM = "udgn";
const GAS_PRICE = GasPrice.fromString(`0.025${DENOM}`);
const TREASURY = "dungeon1aj5jlmvqp8dd26rsec6624szthlazdn2vhxak9";
const ROYALTY_BPS = 500; // 5%

const ARTIFACTS_DIR = path.join(__dirname, "artifacts");
const CW721_WASM = path.join(ARTIFACTS_DIR, "cw721_dungeon.wasm");
const MARKETPLACE_WASM = path.join(ARTIFACTS_DIR, "dungeon_marketplace.wasm");

// ---------- Helpers ----------
function loadEnv() {
  // Simple .env loader — no dependency needed
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- Main ----------
async function main() {
  loadEnv();

  const mnemonic = process.env.HOT_WALLET_MNEMONIC;
  if (!mnemonic) {
    console.error("ERROR: Set HOT_WALLET_MNEMONIC env var or add to .env");
    process.exit(1);
  }

  // Check WASM files exist
  if (!fs.existsSync(CW721_WASM)) {
    console.error(`ERROR: ${CW721_WASM} not found.`);
    console.error("Download artifacts from GitHub Actions and place in scripts/artifacts/");
    process.exit(1);
  }
  if (!fs.existsSync(MARKETPLACE_WASM)) {
    console.error(`ERROR: ${MARKETPLACE_WASM} not found.`);
    process.exit(1);
  }

  // Connect wallet
  console.log("Connecting wallet...");
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: CHAIN_PREFIX,
  });
  const [account] = await wallet.getAccounts();
  console.log(`Wallet address: ${account.address}`);

  const client = await SigningCosmWasmClient.connectWithSigner(RPC_URL, wallet, {
    gasPrice: GAS_PRICE,
  });

  // Check balance
  const balance = await client.getBalance(account.address, DENOM);
  console.log(`Balance: ${balance.amount} ${DENOM}`);
  if (BigInt(balance.amount) < 1000000n) {
    console.error("WARNING: Low balance — may not have enough gas for deployment");
  }

  // Step 1: Store CW721 contract
  console.log("\n=== Step 1: Store CW721 contract ===");
  const cw721Wasm = fs.readFileSync(CW721_WASM);
  console.log(`  WASM size: ${(cw721Wasm.length / 1024).toFixed(0)} KB`);
  const cw721StoreResult = await client.upload(account.address, cw721Wasm, "auto");
  console.log(`  Code ID: ${cw721StoreResult.codeId}`);
  console.log(`  Tx hash: ${cw721StoreResult.transactionHash}`);

  await sleep(3000);

  // Step 2: Store Marketplace contract
  console.log("\n=== Step 2: Store Marketplace contract ===");
  const mktWasm = fs.readFileSync(MARKETPLACE_WASM);
  console.log(`  WASM size: ${(mktWasm.length / 1024).toFixed(0)} KB`);
  const mktStoreResult = await client.upload(account.address, mktWasm, "auto");
  console.log(`  Code ID: ${mktStoreResult.codeId}`);
  console.log(`  Tx hash: ${mktStoreResult.transactionHash}`);

  await sleep(3000);

  // Step 3: Instantiate Hero NFT contract
  console.log("\n=== Step 3: Instantiate Hero NFT contract ===");
  const heroResult = await client.instantiate(
    account.address,
    cw721StoreResult.codeId,
    {
      name: "Dungeon Heroes",
      symbol: "DHERO",
      minter: account.address,
    },
    "dungeon-heroes",
    "auto",
    { admin: account.address }
  );
  const heroContract = heroResult.contractAddress;
  console.log(`  Contract: ${heroContract}`);
  console.log(`  Tx hash: ${heroResult.transactionHash}`);

  await sleep(3000);

  // Step 4: Instantiate Gear NFT contract
  console.log("\n=== Step 4: Instantiate Gear NFT contract ===");
  const gearResult = await client.instantiate(
    account.address,
    cw721StoreResult.codeId,
    {
      name: "Dungeon Gear",
      symbol: "DGEAR",
      minter: account.address,
    },
    "dungeon-gear",
    "auto",
    { admin: account.address }
  );
  const gearContract = gearResult.contractAddress;
  console.log(`  Contract: ${gearContract}`);
  console.log(`  Tx hash: ${gearResult.transactionHash}`);

  await sleep(3000);

  // Step 5: Instantiate Marketplace contract
  console.log("\n=== Step 5: Instantiate Marketplace contract ===");
  const mktResult = await client.instantiate(
    account.address,
    mktStoreResult.codeId,
    {
      treasury: TREASURY,
      royalty_bps: ROYALTY_BPS,
      accepted_nft_contracts: [heroContract, gearContract],
      denom: DENOM,
    },
    "dungeon-marketplace",
    "auto",
    { admin: account.address }
  );
  const mktContract = mktResult.contractAddress;
  console.log(`  Contract: ${mktContract}`);
  console.log(`  Tx hash: ${mktResult.transactionHash}`);

  // Summary
  console.log("\n============================================");
  console.log("Deployment complete!\n");
  console.log(`HERO_NFT_CONTRACT=${heroContract}`);
  console.log(`GEAR_NFT_CONTRACT=${gearContract}`);
  console.log(`MARKETPLACE_CONTRACT=${mktContract}`);
  console.log("\nAdd these to your backend .env and Render environment.");
  console.log("============================================");

  // Write to a file for easy copy
  const outputPath = path.join(__dirname, "deployed-addresses.txt");
  fs.writeFileSync(
    outputPath,
    [
      `HERO_NFT_CONTRACT=${heroContract}`,
      `GEAR_NFT_CONTRACT=${gearContract}`,
      `MARKETPLACE_CONTRACT=${mktContract}`,
      `CW721_CODE_ID=${cw721StoreResult.codeId}`,
      `MARKETPLACE_CODE_ID=${mktStoreResult.codeId}`,
      `DEPLOYER=${account.address}`,
      `DEPLOYED_AT=${new Date().toISOString()}`,
    ].join("\n")
  );
  console.log(`\nAddresses saved to ${outputPath}`);
}

main().catch((err) => {
  console.error("Deployment failed:", err.message);
  process.exit(1);
});
