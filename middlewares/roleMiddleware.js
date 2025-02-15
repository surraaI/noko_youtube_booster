const roleMiddleware = (requiredRoles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized: Please log in' });
        }

        const { role } = req.user;

        if (requiredRoles.length && !requiredRoles.includes(role)) {
            return res.status(403).json({ message: 'Forbidden: Access denied' });
        }

        next();
    };
};

module.exports = { roleMiddleware };
