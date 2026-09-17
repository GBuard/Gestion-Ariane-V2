/**
 * Affiche un créneau compact : « 07/09/2026 de 9h00 à 12h00 »
 */
export function formatSeanceSlot(startIso, endIso) {
    if (!startIso || !endIso) return "—";
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return "—";
    }

    const date = start.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });

    const fmtTime = (d) => {
        const h = d.getHours();
        const m = d.getMinutes();
        return m === 0 ? `${h}h00` : `${h}h${String(m).padStart(2, "0")}`;
    };

    return `${date} de ${fmtTime(start)} à ${fmtTime(end)}`;
}
