/**
 * Même logique que listBySeance : une ligne par bénéficiaire, priorité à l’inscription liée à la séance.
 */
export function mergeInscriptionsForSeance(rawRows, seanceIdStr) {
    const byBen = new Map();
    for (const row of rawRows) {
        const key = row.beneficiaireId?.toString?.();
        if (!key) continue;
        const isSpecific =
            row.seanceId != null &&
            row.seanceId.toString() === seanceIdStr;
        const existing = byBen.get(key);
        if (!existing) {
            byBen.set(key, row);
            continue;
        }
        const existingSpecific =
            existing.seanceId != null &&
            existing.seanceId.toString() === seanceIdStr;
        if (isSpecific && !existingSpecific) {
            byBen.set(key, row);
        }
    }
    return [...byBen.values()];
}
