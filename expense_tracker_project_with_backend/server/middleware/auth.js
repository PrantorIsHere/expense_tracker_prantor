const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = db.get('users')
      .find({ id: decoded.userId })
      .value();

    if (!user) return res.status(401).json({ error: 'User not found' });

    // Expose safe user fields (no password_hash)
    const { password_hash: _ph, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch (e) {
    console.error('Token verification error:', e);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authenticateToken };
