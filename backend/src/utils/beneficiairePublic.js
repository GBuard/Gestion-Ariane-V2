export function beneficiairePublic(doc) {
    return {
        id: doc._id.toString(),
        firstName: doc.firstName,
        lastName: doc.lastName,
        email: doc.email || "",
        phone: doc.phone || "",
        referentId: doc.referentId?.toString?.() ?? String(doc.referentId),
        notes: doc.notes || "",
        isArchived: doc.isArchived,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}
