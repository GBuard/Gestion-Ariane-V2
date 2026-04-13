/**
 * Représentation API d’un utilisateur (jamais de mot de passe).
 */
export function userPublic(doc) {
    return {
        id: doc._id.toString(),
        firstName: doc.firstName,
        lastName: doc.lastName,
        email: doc.email,
        role: doc.role,
        isActive: doc.isActive,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}
