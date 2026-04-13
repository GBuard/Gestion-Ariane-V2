import { verifyAccessToken } from '../utils/jwt.js';

/**
 * Exige un en-tête Authorization: Bearer <token>.
 * Attache req.userId (ObjectId string) en cas de succès.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentification requise' });
  }

  const token = header.slice(7).trim();
  if (!token) {
    return res.status(401).json({ message: 'Token manquant' });
  }

  try {
    const payload = verifyAccessToken(token);
    const id = payload.sub;
    if (!id) {
      return res.status(401).json({ message: 'Token invalide' });
    }
    req.userId = id;
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalide ou expiré' });
  }
}
