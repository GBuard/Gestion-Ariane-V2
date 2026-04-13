export function sallePublic(doc) {
    return {
        id: doc._id.toString(),
        name: doc.name,
        agence: doc.agence || "jean_moulin",
        capacity: doc.capacity,
        location: doc.location ?? "",
        isArchived: doc.isArchived,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}
