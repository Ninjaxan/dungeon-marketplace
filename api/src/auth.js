const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

/**
 * Middleware that verifies JWT from the game backend.
 * Extracts wallet_address and friend_code from the token payload.
 */
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ ok: false, error: 'Missing authorization header' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.walletAddress = payload.wallet_address;
        req.friendCode = payload.friend_code;
        next();
    } catch (err) {
        return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
    }
}

module.exports = { requireAuth };
