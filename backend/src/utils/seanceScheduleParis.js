/**
 * Règles métier : séances en semaine (lun–ven), entre 9h et 17h, fuseau Europe/Paris.
 */
function parisWeekdayAndMinutes(date) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Paris",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);
    const wd = parts.find((p) => p.type === "weekday")?.value;
    const hour = parseInt(
        parts.find((p) => p.type === "hour")?.value ?? "0",
        10,
    );
    const minute = parseInt(
        parts.find((p) => p.type === "minute")?.value ?? "0",
        10,
    );
    return { wd, minutes: hour * 60 + minute };
}

export function assertSeanceParisSchedule(startDate, endDate) {
    const s = parisWeekdayAndMinutes(startDate);
    const e = parisWeekdayAndMinutes(endDate);
    const weekend = new Set(["Sat", "Sun"]);
    if (weekend.has(s.wd) || weekend.has(e.wd)) {
        const err = new Error(
            "Les séances ont lieu du lundi au vendredi uniquement.",
        );
        err.statusCode = 400;
        throw err;
    }
    const startMin = 9 * 60;
    const endMax = 17 * 60;
    if (s.minutes < startMin || e.minutes > endMax) {
        const err = new Error(
            "Horaires autorisés pour les séances : 9h à 17h.",
        );
        err.statusCode = 400;
        throw err;
    }
}
