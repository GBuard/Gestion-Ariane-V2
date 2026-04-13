export function formationPublic(doc) {
    return {
        id: doc._id.toString(),
        title: doc.title,
        description: doc.description ?? "",
        trainerId: doc.trainerId?.toString?.() ?? String(doc.trainerId),
        capacity: doc.capacity ?? null,
        color: doc.color || "#3B82F6",
        isArchived: doc.isArchived,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        /** Renseignés par listFormations enrichi (liste UI). */
        trainerName: doc.trainerName ?? undefined,
        scheduleLabel: doc.scheduleLabel ?? undefined,
        weekdayLabel: doc.weekdayLabel ?? undefined,
    };
}
