import { User } from "../models/User.js";

/**
 * À utiliser après requireAuth. Vérifie que l’utilisateur connecté a un des rôles autorisés.
 * Remplit req.user (document Mongoose).
 */
export function requireRole(...allowedRoles) {
    return async function roleCheck(req, res, next) {
        try {
            const user = await User.findById(req.userId);
            if (!user || !user.isActive) {
                return res.status(401).json({ message: "Non autorisé" });
            }
            if (!allowedRoles.includes(user.role)) {
                return res.status(403).json({ message: "Accès refusé" });
            }
            req.user = user;
            next();
        } catch (err) {
            next(err);
        }
    };
}
