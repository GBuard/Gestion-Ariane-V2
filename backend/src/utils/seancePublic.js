export function seancePublic(doc) {
    return {
        id: doc._id.toString(),
        formationId: doc.formationId?.toString?.() ?? String(doc.formationId),
        salleId: doc.salleId?.toString?.() ?? String(doc.salleId),
        startDate: doc.startDate?.toISOString?.() ?? doc.startDate,
        endDate: doc.endDate?.toISOString?.() ?? doc.endDate,
        capacity: doc.capacity ?? null,
        notes: doc.notes ?? "",
        isArchived: doc.isArchived,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}
