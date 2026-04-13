import mongoose from "mongoose";
import { Formation } from "../models/Formation.js";
import { User } from "../models/User.js";
import { Seance } from "../models/Seance.js";
import { Salle } from "../models/Salle.js";
import { Inscription } from "../models/Inscription.js";
import { formationPublic } from "../utils/formationPublic.js";
import { buildRecurrenceSlots } from "../utils/recurrenceSeances.js";
import { assertNoRoomOverlap } from "../utils/seanceRoomOverlap.js";
import { assertSeanceParisSchedule } from "../utils/seanceScheduleParis.js";

const TRAINER_ROLES = ["admin", "referent", "formateur"];

async function assertTrainerUser(trainerId) {
    const u = await User.findById(trainerId);
    if (!u || !u.isActive || !TRAINER_ROLES.includes(u.role)) {
        const err = new Error(
            "Intervenant invalide : utilisateur actif admin, référent ou formateur requis",
        );
        err.statusCode = 400;
        throw err;
    }
}

function expandShortHexColor(hex) {
    if (hex.length !== 4 || hex[0] !== "#") return hex;
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
}

function normalizeColorInput(raw) {
    if (raw == null || raw === "") {
        return "#3B82F6";
    }
    const s = String(raw).trim();
    if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(s)) {
        const err = new Error("Couleur invalide (format #RGB ou #RRGGBB)");
        err.statusCode = 400;
        throw err;
    }
    return s.length === 4 ? expandShortHexColor(s) : s;
}

async function assertActiveSalle(salleId) {
    const s = await Salle.findById(salleId);
    if (!s || s.isArchived) {
        const err = new Error("Salle introuvable ou archivée");
        err.statusCode = 400;
        throw err;
    }
}

const REC_FREQ = new Set(["weekly", "biweekly", "monthly"]);

function parseRecurrencePayload(rec) {
    if (rec == null || typeof rec !== "object") {
        return null;
    }
    const {
        periodStart,
        periodEnd,
        frequency,
        weekday,
        startTime,
        endTime,
        salleId,
    } = rec;
    const missing = [
        !periodStart && "periodStart",
        !periodEnd && "periodEnd",
        !frequency && "frequency",
        weekday === undefined || weekday === null || weekday === ""
            ? "weekday"
            : null,
        !startTime && "startTime",
        !endTime && "endTime",
        !salleId && "salleId",
    ].filter(Boolean);
    if (missing.length) {
        const err = new Error(
            `Récurrence incomplète : champs requis ${missing.join(", ")}`,
        );
        err.statusCode = 400;
        throw err;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(periodStart))) {
        const err = new Error("periodStart doit être au format YYYY-MM-DD");
        err.statusCode = 400;
        throw err;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(periodEnd))) {
        const err = new Error("periodEnd doit être au format YYYY-MM-DD");
        err.statusCode = 400;
        throw err;
    }
    if (!REC_FREQ.has(String(frequency))) {
        const err = new Error(
            "Fréquence invalide (weekly, biweekly, monthly)",
        );
        err.statusCode = 400;
        throw err;
    }
    const wd = Number(weekday);
    if (!Number.isInteger(wd) || wd < 1 || wd > 7) {
        const err = new Error(
            "weekday doit être un entier entre 1 (lundi) et 7 (dimanche)",
        );
        err.statusCode = 400;
        throw err;
    }
    if (!mongoose.isValidObjectId(salleId)) {
        const err = new Error("salleId invalide");
        err.statusCode = 400;
        throw err;
    }
    return {
        periodStart: String(periodStart),
        periodEnd: String(periodEnd),
        frequency: String(frequency),
        weekday: wd,
        startTime: String(startTime),
        endTime: String(endTime),
        salleId,
    };
}

function scheduleLabelsFromSeance(s) {
    if (!s) {
        return {
            weekdayLabel: "—",
            scheduleLabel: "—",
        };
    }
    const wd = s.startDate.toLocaleDateString("fr-FR", {
        weekday: "long",
        timeZone: "Europe/Paris",
    });
    const weekdayLabel =
        wd.length > 0 ? wd.charAt(0).toUpperCase() + wd.slice(1) : "—";
    const timeStart = s.startDate.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
    });
    const timeEnd = s.endDate.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
    });
    return {
        weekdayLabel,
        scheduleLabel: `${timeStart} – ${timeEnd}`,
    };
}

async function createSeancesFromRecurrence(formationId, capacity, rec) {
    await assertActiveSalle(rec.salleId);
    const slots = buildRecurrenceSlots({
        periodStart: rec.periodStart,
        periodEnd: rec.periodEnd,
        frequency: rec.frequency,
        weekday: rec.weekday,
        startTime: rec.startTime,
        endTime: rec.endTime,
    });

    if (!slots.length) {
        const err = new Error(
            "Aucun créneau généré pour cette période et ce jour",
        );
        err.statusCode = 400;
        throw err;
    }

    const cap = capacity != null ? capacity : null;
    const createdSeanceIds = [];

    for (const slot of slots) {
        assertSeanceParisSchedule(slot.start, slot.end);
        await assertNoRoomOverlap(
            rec.salleId,
            slot.start,
            slot.end,
            null,
        );
        const s = await Seance.create({
            formationId,
            salleId: rec.salleId,
            startDate: slot.start,
            endDate: slot.end,
            capacity: cap,
            notes: "",
            isArchived: false,
        });
        createdSeanceIds.push(s._id);
    }

    return createdSeanceIds;
}

export async function listFormations(req, res) {
    const includeArchived =
        req.query.includeArchived === "true" || req.query.includeArchived === "1";
    const filter = {};

    if (req.user.role === "admin") {
        if (!includeArchived) {
            filter.isArchived = false;
        }
    } else {
        filter.isArchived = false;
    }

    const list = await Formation.find(filter).sort({ title: 1 }).lean();
    const trainerIds = [
        ...new Set(list.map((f) => f.trainerId?.toString()).filter(Boolean)),
    ];
    const trainers = trainerIds.length
        ? await User.find({ _id: { $in: trainerIds } })
              .select("firstName lastName")
              .lean()
        : [];
    const tMap = new Map(trainers.map((u) => [u._id.toString(), u]));

    const fIds = list.map((f) => f._id);
    const seances =
        fIds.length > 0
            ? await Seance.find({
                  formationId: { $in: fIds },
                  isArchived: false,
              })
                  .sort({ startDate: 1 })
                  .lean()
            : [];

    const byFormation = new Map();
    for (const s of seances) {
        const k = s.formationId.toString();
        if (!byFormation.has(k)) byFormation.set(k, []);
        byFormation.get(k).push(s);
    }

    const now = new Date();
    function pickDisplaySeance(arr) {
        if (!arr || !arr.length) return null;
        const upcoming = arr.find((x) => x.endDate >= now);
        return upcoming || arr[arr.length - 1];
    }

    res.json({
        formations: list.map((f) => {
            const tid = f.trainerId?.toString?.();
            const tr = tid ? tMap.get(tid) : null;
            const trainerName = tr
                ? `${tr.firstName} ${tr.lastName}`
                : null;
            const arr = byFormation.get(f._id.toString()) || [];
            const display = pickDisplaySeance(arr);
            const { weekdayLabel, scheduleLabel } =
                scheduleLabelsFromSeance(display);
            return formationPublic({
                ...f,
                trainerName,
                weekdayLabel,
                scheduleLabel,
            });
        }),
    });
}

export async function getFormation(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const f = await Formation.findById(id);
    if (!f) {
        return res.status(404).json({ message: "Formation introuvable" });
    }

    if (req.user.role !== "admin" && f.isArchived) {
        return res.status(404).json({ message: "Formation introuvable" });
    }

    res.json({ formation: formationPublic(f) });
}

export async function createFormation(req, res) {
    const { title, description, trainerId, capacity, color, recurrence } =
        req.body;

    await assertTrainerUser(trainerId);

    const colorNorm = normalizeColorInput(color);
    const rec = parseRecurrencePayload(recurrence);

    let formationDoc = null;
    const createdSeanceIds = [];

    try {
        formationDoc = await Formation.create({
            title: title.trim(),
            description: description != null ? String(description) : "",
            trainerId,
            capacity:
                capacity != null && capacity !== ""
                    ? Number(capacity)
                    : null,
            color: colorNorm,
            isArchived: false,
        });

        if (rec) {
            const ids = await createSeancesFromRecurrence(
                formationDoc._id,
                formationDoc.capacity,
                rec,
            );
            createdSeanceIds.push(...ids);
        }

        const fresh = await Formation.findById(formationDoc._id);
        res.status(201).json({
            formation: formationPublic(fresh),
            seancesCreated: createdSeanceIds.length,
        });
    } catch (err) {
        if (createdSeanceIds.length) {
            await Seance.deleteMany({ _id: { $in: createdSeanceIds } });
        }
        if (formationDoc) {
            await Formation.findByIdAndDelete(formationDoc._id);
        }
        throw err;
    }
}

export async function updateFormation(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const f = await Formation.findById(id);
    if (!f) {
        return res.status(404).json({ message: "Formation introuvable" });
    }

    const {
        title,
        description,
        trainerId,
        capacity,
        isArchived,
        color,
        recurrence,
    } = req.body;

    if (recurrence !== undefined && recurrence !== null && f.isArchived) {
        return res.status(400).json({
            message:
                "Impossible de régénérer les séances d’une formation archivée",
        });
    }

    if (title !== undefined) f.title = String(title).trim();
    if (description !== undefined) f.description = String(description);
    if (trainerId !== undefined) {
        await assertTrainerUser(trainerId);
        f.trainerId = trainerId;
    }
    if (capacity !== undefined) {
        f.capacity =
            capacity === null || capacity === ""
                ? null
                : Number(capacity);
    }
    if (isArchived !== undefined) f.isArchived = Boolean(isArchived);
    if (color !== undefined) {
        f.color = normalizeColorInput(color);
    }

    await f.save();

    let seancesCreated = 0;
    if (recurrence !== undefined && recurrence !== null) {
        const rec = parseRecurrencePayload(recurrence);
        await Inscription.deleteMany({ formationId: f._id });
        await Seance.deleteMany({ formationId: f._id });
        const createdIds = await createSeancesFromRecurrence(
            f._id,
            f.capacity,
            rec,
        );
        seancesCreated = createdIds.length;
    }

    const fresh = await Formation.findById(f._id);
    const payload = { formation: formationPublic(fresh) };
    if (recurrence !== undefined && recurrence !== null) {
        payload.seancesCreated = seancesCreated;
    }
    res.json(payload);
}

export async function archiveFormation(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const f = await Formation.findByIdAndUpdate(
        id,
        { $set: { isArchived: true } },
        { new: true },
    );
    if (!f) {
        return res.status(404).json({ message: "Formation introuvable" });
    }

    res.status(204).send();
}

/**
 * Suppression définitive : inscriptions, séances puis formation.
 */
export async function destroyFormation(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const f = await Formation.findById(id);
    if (!f) {
        return res.status(404).json({ message: "Formation introuvable" });
    }

    if (!f.isArchived) {
        return res.status(400).json({
            message:
                "Seules les formations archivées peuvent être supprimées définitivement",
        });
    }

    await Inscription.deleteMany({ formationId: id });
    await Seance.deleteMany({ formationId: id });
    await Formation.findByIdAndDelete(id);

    res.status(204).send();
}
