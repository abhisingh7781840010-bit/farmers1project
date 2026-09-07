import jwt from 'jsonwebtoken';
import { queryOne } from '../db/connection.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_kisan_jwt_key_2026_secure';
const MASTER_DEV_KEY = 'kisan_mandi_admin_key_2026';

/**
 * Authentication middleware for Admin / Procurement Officer routes
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const apiKey = req.headers['x-api-key'];

  // Master dev key bypass for development & automated tests
  if (apiKey && apiKey === MASTER_DEV_KEY) {
    req.user = {
      id: 'ADM-DEV',
      username: 'master_dev_admin',
      role: 'SUPERADMIN',
      centerId: null
    };
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing or invalid Authorization header. Expected Bearer token.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = queryOne(`SELECT id, username, full_name, role, center_id FROM admin_users WHERE id = ?`, [decoded.id]);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: User does not exist or has been disabled.' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      centerId: user.center_id
    };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or expired token.',
      details: err.message
    });
  }
}

/**
 * Role-Based Access Control
 * @param {string|string[]} roles
 */
export function requireRole(roles) {
  const roleList = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
    }

    if (!roleList.includes(req.user.role) && req.user.role !== 'SUPERADMIN') {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Required role in [${roleList.join(', ')}]. Current role is '${req.user.role}'.`
      });
    }

    next();
  };
}

export default { authenticate, requireRole };
