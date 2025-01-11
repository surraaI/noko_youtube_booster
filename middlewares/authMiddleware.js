const authMiddleware = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }

    if (req.headers.authorization) {
        const token = req.headers.authorization.split(' ')[1]; 
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded; 
            return next();
        } catch (err) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
    }

    // If neither session nor token is valid
    return res.status(401).json({ message: 'Unauthorized' });
};

module.exports = authMiddleware;
