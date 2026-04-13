export function inscriptionPublic(doc) {
    const seanceId = doc.seanceId;
    return {
        id: doc._id.toString(),
        beneficiaireId:
            doc.beneficiaireId?.toString?.() ?? String(doc.beneficiaireId),
        formationId:
            doc.formationId?.toString?.() ?? String(doc.formationId),
        seanceId:
            seanceId == null
                ? null
                : seanceId?.toString?.() ?? String(seanceId),
        status: doc.status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}
