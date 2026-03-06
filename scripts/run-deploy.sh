#!/bin/bash
# Run this in your own terminal:
#   cd C:/Users/ninja/dungeon-marketplace/scripts
#   bash run-deploy.sh

echo "=== Dungeon Marketplace Contract Deployer ==="
echo ""
read -sp "Paste your mnemonic and press Enter: " HOT_WALLET_MNEMONIC
echo ""
echo ""
export HOT_WALLET_MNEMONIC
echo "Deploying contracts to Dungeon Chain..."
echo ""
node deploy-contracts.js
echo ""
echo "Done. Press Enter to close."
read
