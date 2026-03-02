#!/usr/bin/env node
/**
 * Bulk upload baked art assets to Pinata IPFS.
 * Reads gear PNGs and hero portraits, uploads each,
 * and records CID mapping in backend/data/ipfs-map.json.
 *
 * Usage: PINATA_JWT=xxx node scripts/upload-art.js
 */

const fs   = require('fs');
const path = require('path');
const { uploadImage } = require('../src/ipfs');

const ASSETS_ROOT = path.resolve(__dirname, '..', '..', 'Assets');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'ipfs-map.json');

const ASSET_DIRS = [
    { label: 'gear',      dir: path.join(ASSETS_ROOT, 'Sprites', 'Gear'),       type: 'gear' },
    { label: 'characters', dir: path.join(ASSETS_ROOT, 'Sprites', 'Characters'), type: 'hero' },
    { label: 'items',      dir: path.join(ASSETS_ROOT, 'sprites', 'Items'),      type: 'item' },
    { label: 'buildings',  dir: path.join(ASSETS_ROOT, 'Resources', 'Buildings'), type: 'building' },
];

async function main() {
    if (!process.env.PINATA_JWT) {
        console.error('Error: PINATA_JWT env var required');
        process.exit(1);
    }

    // Load existing map
    let ipfsMap = {};
    if (fs.existsSync(OUTPUT_FILE)) {
        ipfsMap = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    }

    let uploaded = 0;
    let skipped = 0;

    for (const { label, dir, type } of ASSET_DIRS) {
        if (!fs.existsSync(dir)) {
            console.log(`Skipping ${label}: directory not found at ${dir}`);
            continue;
        }

        const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
        console.log(`\n=== ${label}: ${files.length} PNGs ===`);

        for (const file of files) {
            const key = `${type}:${path.basename(file, '.png')}`;

            // Skip if already uploaded
            if (ipfsMap[key]) {
                skipped++;
                continue;
            }

            try {
                const filePath = path.join(dir, file);
                const ipfsUri = await uploadImage(filePath);
                ipfsMap[key] = ipfsUri;
                uploaded++;

                // Save incrementally
                fs.writeFileSync(OUTPUT_FILE, JSON.stringify(ipfsMap, null, 2));

                // Rate limit: 100ms between uploads
                await new Promise(r => setTimeout(r, 100));
            } catch (err) {
                console.error(`  Error uploading ${file}: ${err.message}`);
            }
        }
    }

    console.log(`\nDone! Uploaded: ${uploaded}, Skipped: ${skipped}, Total: ${Object.keys(ipfsMap).length}`);
    console.log(`Map saved to: ${OUTPUT_FILE}`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
