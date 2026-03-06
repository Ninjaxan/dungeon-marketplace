@echo off
cd /d "%~dp0"
echo === Dungeon Marketplace Contract Deployer ===
echo.
set /p HOT_WALLET_MNEMONIC="Paste your mnemonic and press Enter: "
echo.
echo Deploying contracts to Dungeon Chain...
echo.
node deploy-contracts.js
echo.
pause
