#!/bin/bash
# Deploy CW721 Dungeon + Marketplace contracts to Dungeon Chain
# Usage: ./deploy.sh [--testnet]
set -euo pipefail

CHAIN_ID="dungeon-1"
NODE="https://rpc.dungeonchain.xyz:443"
FROM="hot-wallet"
DENOM="udgn"
GAS_PRICES="0.025${DENOM}"
GAS_ADJUSTMENT="1.5"
TREASURY="dungeon1aj5jlmvqp8dd26rsec6624szthlazdn2vhxak9"
ROYALTY_BPS=500  # 5%

TX_FLAGS="--chain-id $CHAIN_ID --node $NODE --from $FROM --gas auto --gas-prices $GAS_PRICES --gas-adjustment $GAS_ADJUSTMENT -y --output json"

echo "=== Step 1: Compile contracts with CosmWasm optimizer ==="
docker run --rm -v "$(pwd)":/code \
  --mount type=volume,source="$(basename "$(pwd)")_cache",target=/target \
  --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
  cosmwasm/optimizer:0.16.0

echo ""
echo "=== Step 2: Store CW721 Dungeon contract ==="
CW721_TX=$(dungeond tx wasm store artifacts/cw721_dungeon.wasm $TX_FLAGS | jq -r '.txhash')
echo "CW721 store tx: $CW721_TX"
sleep 6

CW721_CODE_ID=$(dungeond query tx $CW721_TX --node $NODE --output json | jq -r '.events[] | select(.type=="store_code") | .attributes[] | select(.key=="code_id") | .value')
echo "CW721 code ID: $CW721_CODE_ID"

echo ""
echo "=== Step 3: Store Marketplace contract ==="
MKT_TX=$(dungeond tx wasm store artifacts/dungeon_marketplace.wasm $TX_FLAGS | jq -r '.txhash')
echo "Marketplace store tx: $MKT_TX"
sleep 6

MKT_CODE_ID=$(dungeond query tx $MKT_TX --node $NODE --output json | jq -r '.events[] | select(.type=="store_code") | .attributes[] | select(.key=="code_id") | .value')
echo "Marketplace code ID: $MKT_CODE_ID"

echo ""
echo "=== Step 4: Instantiate Hero NFT contract ==="
HERO_INIT=$(cat <<EOF
{"name":"Dungeon Heroes","symbol":"DHERO","minter":"$(dungeond keys show $FROM -a)"}
EOF
)
HERO_TX=$(dungeond tx wasm instantiate $CW721_CODE_ID "$HERO_INIT" --label "dungeon-heroes" --admin "$(dungeond keys show $FROM -a)" $TX_FLAGS | jq -r '.txhash')
echo "Hero NFT instantiate tx: $HERO_TX"
sleep 6

HERO_CONTRACT=$(dungeond query tx $HERO_TX --node $NODE --output json | jq -r '.events[] | select(.type=="instantiate") | .attributes[] | select(.key=="_contract_address") | .value')
echo "Hero NFT contract: $HERO_CONTRACT"

echo ""
echo "=== Step 5: Instantiate Gear NFT contract ==="
GEAR_INIT=$(cat <<EOF
{"name":"Dungeon Gear","symbol":"DGEAR","minter":"$(dungeond keys show $FROM -a)"}
EOF
)
GEAR_TX=$(dungeond tx wasm instantiate $CW721_CODE_ID "$GEAR_INIT" --label "dungeon-gear" --admin "$(dungeond keys show $FROM -a)" $TX_FLAGS | jq -r '.txhash')
echo "Gear NFT instantiate tx: $GEAR_TX"
sleep 6

GEAR_CONTRACT=$(dungeond query tx $GEAR_TX --node $NODE --output json | jq -r '.events[] | select(.type=="instantiate") | .attributes[] | select(.key=="_contract_address") | .value')
echo "Gear NFT contract: $GEAR_CONTRACT"

echo ""
echo "=== Step 6: Instantiate Marketplace contract ==="
MKT_INIT=$(cat <<EOF
{
  "treasury":"$TREASURY",
  "royalty_bps":$ROYALTY_BPS,
  "accepted_nft_contracts":["$HERO_CONTRACT","$GEAR_CONTRACT"],
  "denom":"$DENOM"
}
EOF
)
MKT_INST_TX=$(dungeond tx wasm instantiate $MKT_CODE_ID "$MKT_INIT" --label "dungeon-marketplace" --admin "$(dungeond keys show $FROM -a)" $TX_FLAGS | jq -r '.txhash')
echo "Marketplace instantiate tx: $MKT_INST_TX"
sleep 6

MKT_CONTRACT=$(dungeond query tx $MKT_INST_TX --node $NODE --output json | jq -r '.events[] | select(.type=="instantiate") | .attributes[] | select(.key=="_contract_address") | .value')
echo "Marketplace contract: $MKT_CONTRACT"

echo ""
echo "============================================"
echo "Deployment complete!"
echo ""
echo "HERO_NFT_CONTRACT=$HERO_CONTRACT"
echo "GEAR_NFT_CONTRACT=$GEAR_CONTRACT"
echo "MARKETPLACE_CONTRACT=$MKT_CONTRACT"
echo ""
echo "Add these to your backend .env file."
echo "============================================"
