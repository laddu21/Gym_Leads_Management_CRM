const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'replace-this-secret-in-production';

const authenticateRequest = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'Authorization token is required' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Middleware to restrict access based on user roles
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        const userRole = req.user && req.user.role;
        if (!userRole || !allowedRoles.includes(userRole)) {
            return res.status(403).json({ error: 'Forbidden: insufficient role' });
        }
        next();
    };
};

module.exports = {
    authenticateRequest,
    // Middleware to restrict access based on user roles
    authorizeRoles,
    JWT_SECRET
};
