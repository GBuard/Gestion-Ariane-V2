import {
    parseISO,
    addDays,
    addMonths,
    format,
    startOfMonth,
    endOfMonth,
    isAfter,
    getISODay,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

const TZ = "Europe/Paris";

function pad2(n) {
    return String(n).padStart(2, "0");
}

/** Jour calendaire Paris yyyy-MM-dd à partir d’un instant UTC. */
function formatParisDate(utcDate) {
    return format(toZonedTime(utcDate, TZ), "yyyy-MM-dd");
}

/** Premier jour (string yyyy-MM-dd) ≥ startStr dont le jour ISO = weekday (1=lun … 7=dim). */
function firstIsoWeekdayOnOrAfterDateStr(startStr, weekday) {
    let cur = fromZonedTime(`${startStr}T12:00:00`, TZ);
    for (let i = 0; i < 400; i += 1) {
        if (getISODay(cur) === weekday) {
            return formatParisDate(cur);
        }
        cur = addDays(cur, 1);
    }
    throw new Error("Impossible de trouver le jour demandé dans la période");
}

function eachDateStrInRangeInclusive(startStr, endStr) {
    const out = [];
    let cur = fromZonedTime(`${startStr}T12:00:00`, TZ);
    const end = fromZonedTime(`${endStr}T12:00:00`, TZ);
    while (!isAfter(cur, end)) {
        out.push(formatParisDate(cur));
        cur = addDays(cur, 1);
    }
    return out;
}

function addDaysToDateStr(ds, n) {
    const d = addDays(fromZonedTime(`${ds}T12:00:00`, TZ), n);
    return formatParisDate(d);
}

function parseTimeToParts(t) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isInteger(h) || !Number.isInteger(min) || h < 0 || h > 23 || min < 0 || min > 59) {
        return null;
    }
    return { h, min };
}

/**
 * @param {object} p
 * @param {string} p.periodStart yyyy-MM-dd
 * @param {string} p.periodEnd yyyy-MM-dd
 * @param {'weekly'|'biweekly'|'monthly'} p.frequency
 * @param {number} p.weekday ISO 1=lundi … 7=dimanche
 * @param {string} p.startTime HH:mm
 * @param {string} p.endTime HH:mm
 * @returns {{ start: Date, end: Date }[]}
 */
export function buildRecurrenceSlots(p) {
    const {
        periodStart,
        periodEnd,
        frequency,
        weekday,
        startTime,
        endTime,
    } = p;

    if (weekday < 1 || weekday > 7) {
        throw new Error("weekday doit être entre 1 (lundi) et 7 (dimanche)");
    }

    const st = parseTimeToParts(startTime);
    const et = parseTimeToParts(endTime);
    if (!st || !et) {
        throw new Error("Heures invalides (format HH:mm)");
    }

    const slotForDateStr = (ds) => {
        const start = fromZonedTime(
            `${ds}T${pad2(st.h)}:${pad2(st.min)}:00`,
            TZ,
        );
        const end = fromZonedTime(
            `${ds}T${pad2(et.h)}:${pad2(et.min)}:00`,
            TZ,
        );
        if (end <= start) {
            throw new Error("L’heure de fin doit être après l’heure de début");
        }
        return { start, end };
    };

    if (isAfter(parseISO(periodStart), parseISO(periodEnd))) {
        throw new Error("La date de fin doit être après la date de début");
    }

    const slots = [];

    if (frequency === "weekly") {
        const days = eachDateStrInRangeInclusive(periodStart, periodEnd);
        for (const ds of days) {
            const mid = fromZonedTime(`${ds}T12:00:00`, TZ);
            if (getISODay(mid) !== weekday) continue;
            slots.push(slotForDateStr(ds));
        }
        return slots;
    }

    if (frequency === "biweekly") {
        let ds = firstIsoWeekdayOnOrAfterDateStr(periodStart, weekday);
        while (ds <= periodEnd) {
            slots.push(slotForDateStr(ds));
            ds = addDaysToDateStr(ds, 14);
        }
        return slots;
    }

    if (frequency === "monthly") {
        let monthCursor = startOfMonth(parseISO(`${periodStart}T12:00:00Z`));
        const lastMonth = endOfMonth(parseISO(`${periodEnd}T12:00:00Z`));

        while (!isAfter(monthCursor, lastMonth)) {
            const mStartStr = format(monthCursor, "yyyy-MM-dd");
            const mEnd = endOfMonth(monthCursor);
            const mEndStr = format(mEnd, "yyyy-MM-dd");

            const windowStart =
                periodStart > mStartStr ? periodStart : mStartStr;
            let ds = firstIsoWeekdayOnOrAfterDateStr(windowStart, weekday);
            if (ds > mEndStr || ds > periodEnd) {
                monthCursor = addMonths(monthCursor, 1);
                continue;
            }
            if (ds >= periodStart && ds <= periodEnd) {
                slots.push(slotForDateStr(ds));
            }
            monthCursor = addMonths(monthCursor, 1);
        }
        return slots;
    }

    throw new Error("Fréquence invalide (weekly, biweekly, monthly)");
}
