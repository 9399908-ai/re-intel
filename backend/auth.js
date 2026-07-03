import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export const hashPassword = (password) => bcrypt.hash(password, 10);
export const hashPasswordSync = (password) => bcrypt.hashSync(password, 10);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

export const signToken = (user) =>
  jwt.sign(
    { id: user.id, name: user.name, email: user.email, isAdmin: !!user.isAdmin },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

export const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

// Strip sensitive fields before sending a user over the wire
export const sanitizeUser = ({ passwordHash, ...user }) => user;

// Middleware factory. Every request re-loads the account so removals and
// admin promotions/demotions take effect immediately — a valid JWT alone is
// not enough if the account is gone or no longer verified.
export function makeAuthMiddleware(getUserByEmail) {
  const requireAuth = async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'authentication required' });
    try {
      const payload = verifyToken(token);
      const user = await getUserByEmail(payload.email);
      if (!user || !user.verified) {
        return res.status(401).json({ error: 'account no longer active' });
      }
      req.user = { id: user.id, name: user.name, email: user.email, isAdmin: !!user.isAdmin };
      next();
    } catch (err) {
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'invalid or expired token' });
      }
      next(err);
    }
  };

  const requireAdmin = (req, res, next) => {
    requireAuth(req, res, () => {
      if (!req.user.isAdmin) return res.status(403).json({ error: 'admin access required' });
      next();
    });
  };

  const authenticateSocket = async (token) => {
    const payload = verifyToken(token);
    const user = await getUserByEmail(payload.email);
    if (!user || !user.verified) return null;
    return { id: user.id, name: user.name, email: user.email, isAdmin: !!user.isAdmin };
  };

  return { requireAuth, requireAdmin, authenticateSocket };
}
