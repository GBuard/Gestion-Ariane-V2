import mongoose from "mongoose";
import { Seance } from "../models/Seance.js";
import { Formation } from "../models/Formation.js";
import { Salle } from "../models/Salle.js";
import { Inscription } from "../models/Inscription.js";
import { Beneficiaire } from "../models/Beneficiaire.js";
import { User } from "../models/User.js";
import { seancePublic } from "../utils/seancePublic.js";
import { mergeInscriptionsForSeance } from "../utils/seanceInscriptionsMerge.js";
import { assertSeanceParisSchedule } from "../utils/seanceScheduleParis.js";
import { assertNoRoomOverlap } from "../utils/seanceRoomOverlap.js";
import { applyFormateurSeanceScope } from "../utils/seanceScope.js";

function parseDates(startRaw, endRaw) {
    const startDate = new Date(startRaw);
    const endDate = new Date(endRaw);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        const err = new Error("Dates invalides");
        err.statusCode = 400;
        throw err;
    }
    if (endDate <= startDate) {
        const err = new Error("La date de fin doit être après la date de début");
        err.statusCode = 400;
        throw err;
    }
    return { startDate, endDate };
}

async function assertActiveFormation(formationId) {
    const f = await Formation.findById(formationId);
    if (!f || f.isArchived) {
        const err = new Error("Formation introuvable ou archivée");
        err.statusCode = 400;
        throw err;
    }
}

async function assertActiveSalle(salleId) {
    const s = await Salle.findById(salleId);
    if (!s || s.isArchived) {
        const err = new Error("Salle introuvable ou archivée");
        err.statusCode = 400;
        throw err;
    }
}

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listSeances(req, res) {
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

    const { formationId, q, sort } = req.query;

    let formationFilterId = null;
    if (formationId) {
        if (!mongoose.isValidObjectId(formationId)) {
            return res.status(400).json({ message: "formationId invalide" });
        }
        formationFilterId = formationId;
    }

    if (q && String(q).trim()) {
        const rx = new RegExp(escapeRegex(String(q).trim()), "i");
        const fFilter = { title: rx };
        if (req.user.role !== "admin" || !includeArchived) {
            fFilter.isArchived = false;
        }
        const fIds = await Formation.find(fFilter).select("_id").lean();
        const ids = fIds.map((x) => x._id);
        if (!ids.length) {
            return res.json({ seances: [] });
        }
        if (formationFilterId) {
            const ok = ids.some(
                (x) => x.toString() === formationFilterId.toString(),
            );
            if (!ok) {
                return res.json({ seances: [] });
            }
            filter.formationId = formationFilterId;
        } else {
            filter.formationId = { $in: ids };
        }
    } else if (formationFilterId) {
        filter.formationId = formationFilterId;
    }

    const { period } = req.query;
    const t = new Date();
    if (period === "past") {
        filter.endDate = { $lt: t };
    } else if (period === "upcoming") {
        filter.endDate = { $gte: t };
    }

    await applyFormateurSeanceScope(filter, req.user);

    const sortSpec =
        sort === "startDate_desc" ? { startDate: -1 } : { startDate: 1 };

    const list = await Seance.find(filter)
        .populate({ path: "formationId", select: "title" })
        .sort(sortSpec)
        .lean();

    let rows = list.map((x) => {
        const title =
            x.formationId && typeof x.formationId === "object"
                ? x.formationId.title
                : "";
        const fid =
            x.formationId && typeof x.formationId === "object"
                ? x.formationId._id
                : x.formationId;
        const plain = { ...x, formationId: fid };
        return {
            ...seancePublic(plain),
            formationTitle: title || "",
        };
    });

    if (sort === "formationTitle") {
        rows = rows.sort((a, b) =>
            a.formationTitle.localeCompare(b.formationTitle, "fr", {
                sensitivity: "base",
            }),
        );
    } else if (sort === "formationTitle_desc") {
        rows = rows.sort((a, b) =>
            b.formationTitle.localeCompare(a.formationTitle, "fr", {
                sensitivity: "base",
            }),
        );
    }

    res.json({ seances: rows });
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export async function getSeanceFeuilleEmargement(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const seance = await Seance.findById(id);
    if (!seance) {
        return res.status(404).json({ message: "Séance introuvable" });
    }

    if (req.user.role !== "admin" && seance.isArchived) {
        return res.status(404).json({ message: "Séance introuvable" });
    }

    const formation = await Formation.findById(seance.formationId);
    if (!formation || formation.isArchived) {
        return res.status(404).json({ message: "Formation introuvable" });
    }

    if (req.user.role === "formateur") {
        if (formation.trainerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Accès refusé" });
        }
    }

    const salle = await Salle.findById(seance.salleId).lean();
    const trainer = await User.findById(formation.trainerId)
        .select("firstName lastName")
        .lean();

    const raw = await Inscription.find({
        formationId: seance.formationId,
        $or: [{ seanceId: seance._id }, { seanceId: null }],
    }).lean();
    const merged = mergeInscriptionsForSeance(raw, seance._id.toString());
    const benIds = merged.map((m) => m.beneficiaireId);
    const bens = await Beneficiaire.find({ _id: { $in: benIds } })
        .sort({ lastName: 1, firstName: 1 })
        .lean();

    const lieu =
        [salle?.location, salle?.name].filter(Boolean).join(" — ") || "—";
    const dateStr = seance.startDate.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Paris",
    });
    const horaire = `${seance.startDate.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
    })} – ${seance.endDate.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
    })}`;
    const trainerName = trainer
        ? `${trainer.firstName} ${trainer.lastName}`
        : "—";

    const rows = bens
        .map(
            (b) =>
                `<tr><td>${escapeHtml(b.lastName)} ${escapeHtml(b.firstName)}</td><td style="height:36px">&nbsp;</td></tr>`,
        )
        .join("");

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Feuille d'émargement</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 1.25rem; margin: 0 0 8px; color: #1e40af; }
  .meta { margin: 8px 0 16px; line-height: 1.6; }
  table { border-collapse: collapse; width: 100%; max-width: 800px; }
  th, td { border: 1px solid #333; padding: 10px; text-align: left; }
  th { background: #f3f4f6; }
  .muted { color: #6b7280; font-size: 0.9rem; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
<p class="muted">DIRE — Feuille d'émargement atelier</p>
<h1>${escapeHtml(formation.title)}</h1>
<div class="meta">
  <div><strong>Lieu :</strong> ${escapeHtml(lieu)}</div>
  <div><strong>Date :</strong> ${escapeHtml(dateStr)}</div>
  <div><strong>Horaires :</strong> ${escapeHtml(horaire)}</div>
</div>
<table>
  <thead><tr><th>NOM — PRÉNOM</th><th>Signature / présence</th></tr></thead>
  <tbody>${
      rows ||
      `<tr><td colspan="2" class="muted">Aucun bénéficiaire inscrit</td></tr>`
  }</tbody>
</table>
<div class="meta" style="margin-top:24px">
  <div><strong>Nom prénom formateur :</strong> ${escapeHtml(trainerName)}</div>
  <div style="margin-top:12px"><strong>Signature formateur :</strong> ___________________________</div>
</div>
<p class="no-print"><button type="button" onclick="window.print()">Imprimer</button></p>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
}

export async function getSeance(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const x = await Seance.findById(id);
    if (!x) {
        return res.status(404).json({ message: "Séance introuvable" });
    }

    if (req.user.role !== "admin" && x.isArchived) {
        return res.status(404).json({ message: "Séance introuvable" });
    }

    res.json({ seance: seancePublic(x) });
}

export async function createSeance(req, res) {
    const { formationId, salleId, startDate, endDate, capacity, notes } =
        req.body;

    await assertActiveFormation(formationId);
    await assertActiveSalle(salleId);

    const dates = parseDates(startDate, endDate);
    assertSeanceParisSchedule(dates.startDate, dates.endDate);
    await assertNoRoomOverlap(salleId, dates.startDate, dates.endDate, null);

    const x = await Seance.create({
        formationId,
        salleId,
        startDate: dates.startDate,
        endDate: dates.endDate,
        capacity:
            capacity != null && capacity !== ""
                ? Number(capacity)
                : null,
        notes: notes != null ? String(notes) : "",
        isArchived: false,
    });

    res.status(201).json({ seance: seancePublic(x) });
}

export async function updateSeance(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const x = await Seance.findById(id);
    if (!x) {
        return res.status(404).json({ message: "Séance introuvable" });
    }

    const {
        formationId,
        salleId,
        startDate,
        endDate,
        capacity,
        notes,
        isArchived,
    } = req.body;

    let nextFormationId = x.formationId;
    let nextSalleId = x.salleId;
    let nextStart = x.startDate;
    let nextEnd = x.endDate;

    if (formationId !== undefined) {
        await assertActiveFormation(formationId);
        nextFormationId = formationId;
    }
    if (salleId !== undefined) {
        await assertActiveSalle(salleId);
        nextSalleId = salleId;
    }

    if (startDate !== undefined || endDate !== undefined) {
        const s = startDate !== undefined ? startDate : x.startDate;
        const e = endDate !== undefined ? endDate : x.endDate;
        const dates = parseDates(s, e);
        nextStart = dates.startDate;
        nextEnd = dates.endDate;
    }

    await assertNoRoomOverlap(nextSalleId, nextStart, nextEnd, x._id);
    if (startDate !== undefined || endDate !== undefined) {
        assertSeanceParisSchedule(nextStart, nextEnd);
    }

    x.formationId = nextFormationId;
    x.salleId = nextSalleId;
    x.startDate = nextStart;
    x.endDate = nextEnd;

    if (capacity !== undefined) {
        x.capacity =
            capacity === null || capacity === ""
                ? null
                : Number(capacity);
    }
    if (notes !== undefined) x.notes = String(notes);
    if (isArchived !== undefined) x.isArchived = Boolean(isArchived);

    await x.save();
    const fresh = await Seance.findById(x._id);
    res.json({ seance: seancePublic(fresh) });
}

export async function archiveSeance(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const x = await Seance.findByIdAndUpdate(
        id,
        { $set: { isArchived: true } },
        { new: true },
    );
    if (!x) {
        return res.status(404).json({ message: "Séance introuvable" });
    }

    res.status(204).send();
}

/**
 * Suppression définitive (page archives) : réservé aux séances déjà archivées.
 * Supprime les inscriptions liées à cette séance (seanceId), pas les inscriptions « toute formation ».
 */
export async function destroySeancePermanent(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const x = await Seance.findById(id);
    if (!x) {
        return res.status(404).json({ message: "Séance introuvable" });
    }

    if (!x.isArchived) {
        return res.status(400).json({
            message:
                "Seules les séances archivées peuvent être supprimées définitivement",
        });
    }

    await Inscription.deleteMany({ seanceId: id });
    await Seance.findByIdAndDelete(id);
    res.status(204).send();
}

/**
 * Données pour le calendrier : titre formation + nombre d’inscrits (séance ou inscription « toute formation »).
 */
export async function listCalendarEvents(req, res) {
    const includeArchived =
        req.query.includeArchived === "true" || req.query.includeArchived === "1";
    const agenceRaw = req.query.agence;
    const agence =
        agenceRaw === "strasbourg" || agenceRaw === "jean_moulin"
            ? agenceRaw
            : null;

    const filter = {};

    if (req.user.role === "admin") {
        if (!includeArchived) {
            filter.isArchived = false;
        }
    } else {
        filter.isArchived = false;
    }

    await applyFormateurSeanceScope(filter, req.user);

    const formationColl = Formation.collection.name;
    const inscriptionColl = Inscription.collection.name;
    const salleColl = Salle.collection.name;

    const pipeline = [
        { $match: filter },
        { $sort: { startDate: 1 } },
        {
            $lookup: {
                from: salleColl,
                localField: "salleId",
                foreignField: "_id",
                as: "salle",
            },
        },
        {
            $unwind: {
                path: "$salle",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $addFields: {
                salleAgence: { $ifNull: ["$salle.agence", "jean_moulin"] },
            },
        },
        ...(agence
            ? [{ $match: { salleAgence: agence } }]
            : []),
        {
            $lookup: {
                from: formationColl,
                localField: "formationId",
                foreignField: "_id",
                as: "formation",
            },
        },
        { $unwind: "$formation" },
        {
            $lookup: {
                from: inscriptionColl,
                let: { fid: "$formationId", sid: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$formationId", "$$fid"] },
                                    {
                                        $or: [
                                            { $eq: ["$seanceId", "$$sid"] },
                                            { $eq: ["$seanceId", null] },
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                ],
                as: "insc",
            },
        },
        {
            $project: {
                startDate: 1,
                endDate: 1,
                formationId: 1,
                salleId: 1,
                notes: 1,
                capacity: 1,
                formationTitle: "$formation.title",
                formationColor: {
                    $ifNull: ["$formation.color", "#3B82F6"],
                },
                maxCapacity: {
                    $ifNull: ["$capacity", "$formation.capacity"],
                },
                inscriptionCount: { $size: "$insc" },
                salleName: { $ifNull: ["$salle.name", ""] },
                salleAgence: 1,
            },
        },
    ];

    const rows = await Seance.aggregate(pipeline);

    const events = rows.map((r) => ({
        id: r._id.toString(),
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
        formationId: r.formationId.toString(),
        formationTitle: r.formationTitle,
        formationColor: r.formationColor,
        maxCapacity:
            r.maxCapacity != null && r.maxCapacity !== undefined
                ? r.maxCapacity
                : null,
        salleId: r.salleId.toString(),
        salleName: r.salleName || "",
        agence: r.salleAgence || "jean_moulin",
        notes: r.notes || "",
        inscriptionCount: r.inscriptionCount,
    }));

    res.json({ events });
}
