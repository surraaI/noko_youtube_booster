const jwt = require('jsonwebtoken');

const verifyTransactionToken = (req, res, next) => {
    const token = req.headers['x-transaction-token'];
    
    if (!token) {
        return res.status(401).json({ 
            error: 'Transaction authorization required',
            code: 'MISSING_TRANSACTION_TOKEN'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Validate token structure
        if (decoded.purpose !== 'withdrawal' || !decoded.userId) {
            return res.status(401).json({
                error: 'Invalid transaction token format',
                code: 'INVALID_TOKEN_FORMAT'
            });
        }

        // Verify user match
        if (decoded.userId !== req.user.id) {
            return res.status(403).json({
                error: 'Token user mismatch',
                code: 'USER_MISMATCH'
            });
        }

        // Check expiration
        if (decoded.exp * 1000 < Date.now()) {
            return res.status(401).json({
                error: 'Transaction session expired',
                code: 'TRANSACTION_EXPIRED'
            });
        }

        // Attach validated transaction data
        req.transaction = {
            userId: decoded.userId,
            iat: new Date(decoded.iat * 1000),
            exp: new Date(decoded.exp * 1000)
        };

        next();
    } catch (error) {
        const response = {
            code: 'INVALID_TRANSACTION_TOKEN',
            error: 'Failed to authenticate transaction'
        };

        if (error.name === 'TokenExpiredError') {
            response.code = 'TRANSACTION_EXPIRED';
            response.error = 'Transaction session timed out';
        }

        res.status(401).json(response);
    }
};

module.exports = { verifyTransactionToken };