// middlewares/transactionAuth.js
const verifyTransactionToken = (req, res, next) => {
    const token = req.headers['x-transaction-token'];
    
    if (!token) {
      return res.status(401).json({ error: 'Transaction token required' });
    }
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.purpose !== 'withdrawal' || decoded.userId !== req.user.id) {
        throw new Error('Invalid token context');
      }
  
      req.transaction = decoded;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid transaction token' });
    }
  };
  
  // Apply to withdrawal routes
  router.post('/withdrawals', 
    authMiddleware,
    verifyTransactionToken,
    withdrawalController.createWithdrawal
  );