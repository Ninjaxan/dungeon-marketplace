const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

// ── Env ─────────────────────────────────────────────────────────────────────

const PINATA_JWT     = process.env.PINATA_JWT || '';
const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud';

// ── Upload image file to Pinata IPFS ────────────────────────────────────────

async function uploadImage(filePath) {
    if (!PINATA_JWT) throw new Error('PINATA_JWT not configured');

    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    const fileName = path.basename(filePath);
    form.append('pinataMetadata', JSON.stringify({ name: fileName }));

    const res = await axios.post(`${PINATA_API_URL}/pinning/pinFileToIPFS`, form, {
        maxBodyLength: Infinity,
        headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${PINATA_JWT}`,
        },
    });

    const cid = res.data.IpfsHash;
    console.log(`[IPFS] Uploaded image ${fileName} → ipfs://${cid}`);
    return `ipfs://${cid}`;
}

// ── Upload image from buffer ────────────────────────────────────────────────

async function uploadImageBuffer(buffer, fileName) {
    if (!PINATA_JWT) throw new Error('PINATA_JWT not configured');

    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', buffer, { filename: fileName, contentType: 'image/png' });
    form.append('pinataMetadata', JSON.stringify({ name: fileName }));

    const res = await axios.post(`${PINATA_API_URL}/pinning/pinFileToIPFS`, form, {
        maxBodyLength: Infinity,
        headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${PINATA_JWT}`,
        },
    });

    const cid = res.data.IpfsHash;
    console.log(`[IPFS] Uploaded buffer ${fileName} → ipfs://${cid}`);
    return `ipfs://${cid}`;
}

// ── Upload JSON metadata to Pinata IPFS ─────────────────────────────────────

async function uploadMetadata(metadata) {
    if (!PINATA_JWT) throw new Error('PINATA_JWT not configured');

    const res = await axios.post(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
        pinataContent: metadata,
        pinataMetadata: { name: metadata.name || 'metadata.json' },
    }, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${PINATA_JWT}`,
        },
    });

    const cid = res.data.IpfsHash;
    console.log(`[IPFS] Uploaded metadata ${metadata.name} → ipfs://${cid}`);
    return `ipfs://${cid}`;
}

// ── Resolve IPFS URI to HTTP gateway URL ────────────────────────────────────

function resolveIpfsUrl(ipfsUri) {
    if (!ipfsUri) return '';
    if (ipfsUri.startsWith('ipfs://')) {
        return `${PINATA_GATEWAY}/ipfs/${ipfsUri.slice(7)}`;
    }
    return ipfsUri;
}

module.exports = { uploadImage, uploadImageBuffer, uploadMetadata, resolveIpfsUrl };
