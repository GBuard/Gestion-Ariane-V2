import mongoose from "mongoose";
import { Inscription, INSCRIPTION_STATUSES } from "../models/Inscription.js";
import { Beneficiaire } from "../models/Beneficiaire.js";
import { Formation } from "../models/Formation.js";
import { Seance } from "../models/Seance.js";
import { Salle } from "../models/Salle.js";
import { inscriptionPublic } from "../utils/inscriptionPublic.js";
import { seancePublic } from "../utils/seancePublic.js";
import { mergeInscriptionsForSeance } from "../utils/seanceInscriptionsMerge.js";

async function beneficiaireIdsForReferent(userId) {
    const rows = await Beneficiaire.find({
        referentId: userId,
        isArchived: false,
    })
        .select("_id")
        .lean();
    return rows.map((r) => r._id);
}

async function formationIdsForFormateur(userId) {
    const rows = await Formation.find({
        trainerId: userId,
        isArchived: false,
    })
        .select("_id")
        .lean();
    return rows.map((r) => r._id);
}

function normalizeSeanceId(raw) {
    if (raw === undefined || raw === null || raw === "") {
        return null;
    }
    return raw;
}

export async function listInscriptions(req, res) {
    const filter = {};
    const { beneficiaireId, formationId } = req.query;

    if (beneficiaireId) {
        if (!mongoose.isValidObjectId(beneficiaireId)) {
            return res.status(400).json({ message: "beneficiaireId invalide" });
        }
        filter.beneficiaireId = beneficiaireId;
    }
    if (formationId) {
        if (!mongoose.isValidObjectId(formationId)) {
            return res.status(400).json({ message: "formationId invalide" });
        }
        filter.formationId = formationId;
    }

    if (req.user.role === "admin") {
        const list = await Inscription.find(filter).sort({ createdAt: -1 });
        return res.json({
            inscriptions: list.map((x) => inscriptionPublic(x)),
        });
    }

    if (req.user.role === "referent") {
        const ids = await beneficiaireIdsForReferent(req.user._id);
        if (beneficiaireId) {
            if (!ids.some((id) => id.toString() === beneficiaireId)) {
                return res.json({ inscriptions: [] });
            }
            filter.beneficiaireId = beneficiaireId;
        } else {
            filter.beneficiaireId = { $in: ids };
        }
        const list = await Inscription.find(filter).sort({ createdAt: -1 });
        return res.json({
            inscriptions: list.map((x) => inscriptionPublic(x)),
        });
    }

    const fIds = await formationIdsForFormateur(req.user._id);
    if (formationId) {
        if (!fIds.some((id) => id.toString() === formationId)) {
            return res.json({ inscriptions: [] });
        }
        filter.formationId = formationId;
    } else {
        filter.formationId = { $in: fIds };
    }
    if (beneficiaireId) {
        filter.beneficiaireId = beneficiaireId;
    }
    const list = await Inscription.find(filter).sort({ createdAt: -1 });
    res.json({ inscriptions: list.map((x) => inscriptionPublic(x)) });
}

export async function listByBeneficiaire(req, res) {
    const { beneficiaireId } = req.params;
    if (!mongoose.isValidObjectId(beneficiaireId)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const b = await Beneficiaire.findById(beneficiaireId);
    if (!b || b.isArchived) {
        return res.status(404).json({ message: "Bénéficiaire introuvable" });
    }

    if (req.user.role === "referent") {
        if (b.referentId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Accès refusé" });
        }
    } else if (req.user.role === "formateur") {
        return res.status(403).json({ message: "Accès refusé" });
    }

    const list = await Inscription.find({ beneficiaireId }).sort({
        createdAt: -1,
    });
    res.json({ inscriptions: list.map((x) => inscriptionPublic(x)) });
}

export async function listBySeance(req, res) {
    const { seanceId } = req.params;
    if (!mongoose.isValidObjectId(seanceId)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const seance = await Seance.findById(seanceId);
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

    const salle = await Salle.findById(seance.salleId).select("name").lean();

    const raw = await Inscription.find({
        formationId: seance.formationId,
        $or: [{ seanceId: seance._id }, { seanceId: null }],
    }).lean();

    const merged = mergeInscriptionsForSeance(raw, seanceId);
    const benIds = merged.map((m) => m.beneficiaireId);
    const bens = await Beneficiaire.find({ _id: { $in: benIds } }).lean();
    const bMap = new Map(bens.map((b) => [b._id.toString(), b]));

    const inscriptions = merged.map((row) => {
        const b = bMap.get(row.beneficiaireId.toString());
        return {
            ...inscriptionPublic(row),
            beneficiaire: b
                ? {
                      id: b._id.toString(),
                      firstName: b.firstName,
                      lastName: b.lastName,
                      referentId: b.referentId.toString(),
                  }
                : null,
        };
    });

    res.json({
        seance: seancePublic(seance),
        formationTitle: formation.title,
        salleName: salle?.name || "",
        inscriptions,
    });
}

export async function listByFormation(req, res) {
    const { formationId } = req.params;
    if (!mongoose.isValidObjectId(formationId)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const f = await Formation.findById(formationId);
    if (!f || f.isArchived) {
        return res.status(404).json({ message: "Formation introuvable" });
    }

    if (req.user.role === "formateur") {
        if (f.trainerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Accès refusé" });
        }
    }

    const list = await Inscription.find({ formationId }).sort({
        createdAt: -1,
    });
    res.json({ inscriptions: list.map((x) => inscriptionPublic(x)) });
}

export async function createInscriptionsBulk(req, res) {
    const {
        beneficiaireId,
        formationId,
        seanceId: seanceRaw,
        allSeances,
        nextSeancesCount: nextSeancesCountRaw,
        status,
    } = req.body;
    const seanceId = normalizeSeanceId(seanceRaw);
    const nextSeancesCount =
        nextSeancesCountRaw !== undefined &&
        nextSeancesCountRaw !== null &&
        nextSeancesCountRaw !== ""
            ? Number(nextSeancesCountRaw)
            : NaN;

    const b = await Beneficiaire.findById(beneficiaireId);
    if (!b || b.isArchived) {
        return res
            .status(400)
            .json({ message: "Bénéficiaire invalide ou archivé" });
    }

    if (req.user.role === "referent") {
        if (b.referentId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Accès refusé" });
        }
    }

    const f = await Formation.findById(formationId);
    if (!f || f.isArchived) {
        return res
            .status(400)
            .json({ message: "Formation invalide ou archivée" });
    }

    const st =
        status && INSCRIPTION_STATUSES.includes(status)
            ? status
            : "inscrit";

    if (Number.isInteger(nextSeancesCount) && nextSeancesCount >= 1) {
        const seances = await Seance.find({
            formationId,
            isArchived: false,
            startDate: { $gte: new Date() },
        })
            .sort({ startDate: 1 })
            .limit(Math.min(100, nextSeancesCount))
            .select("_id")
            .lean();

        if (!seances.length) {
            return res.status(400).json({
                message: "Aucune séance à venir pour cette formation",
            });
        }

        const created = [];
        const skippedSeanceIds = [];

        for (const s of seances) {
            try {
                const x = await Inscription.create({
                    beneficiaireId,
                    formationId,
                    seanceId: s._id,
                    status: st,
                });
                created.push(inscriptionPublic(x));
            } catch (err) {
                if (err.code === 11000) {
                    skippedSeanceIds.push(s._id.toString());
                } else {
                    throw err;
                }
            }
        }

        return res.status(201).json({
            created,
            skippedSeanceIds,
            count: created.length,
        });
    }

    if (allSeances === true) {
        const seances = await Seance.find({
            formationId,
            isArchived: false,
        })
            .select("_id")
            .sort({ startDate: 1 })
            .lean();

        const created = [];
        const skippedSeanceIds = [];

        for (const s of seances) {
            try {
                const x = await Inscription.create({
                    beneficiaireId,
                    formationId,
                    seanceId: s._id,
                    status: st,
                });
                created.push(inscriptionPublic(x));
            } catch (err) {
                if (err.code === 11000) {
                    skippedSeanceIds.push(s._id.toString());
                } else {
                    throw err;
                }
            }
        }

        return res.status(201).json({
            created,
            skippedSeanceIds,
            count: created.length,
        });
    }

    if (!seanceId) {
        return res.status(400).json({
            message:
                "seanceId est requis lorsque allSeances est absent ou faux",
        });
    }

    if (!mongoose.isValidObjectId(seanceId)) {
        return res.status(400).json({ message: "Séance invalide" });
    }
    const s = await Seance.findById(seanceId);
    if (!s || s.isArchived) {
        return res.status(400).json({ message: "Séance invalide ou archivée" });
    }
    if (s.formationId.toString() !== formationId) {
        return res.status(400).json({
            message: "La séance n’appartient pas à cette formation",
        });
    }

    try {
        const x = await Inscription.create({
            beneficiaireId,
            formationId,
            seanceId,
            status: st,
        });
        return res.status(201).json({
            created: [inscriptionPublic(x)],
            skippedSeanceIds: [],
            count: 1,
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                message:
                    "Cette inscription existe déjà pour ce bénéficiaire et ce créneau / formation",
            });
        }
        throw err;
    }
}

export async function createInscription(req, res) {
    const { beneficiaireId, formationId, seanceId: seanceRaw, status } =
        req.body;
    const seanceId = normalizeSeanceId(seanceRaw);

    const b = await Beneficiaire.findById(beneficiaireId);
    if (!b || b.isArchived) {
        return res.status(400).json({ message: "Bénéficiaire invalide ou archivé" });
    }

    if (req.user.role === "referent") {
        if (b.referentId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Accès refusé" });
        }
    }

    const f = await Formation.findById(formationId);
    if (!f || f.isArchived) {
        return res.status(400).json({ message: "Formation invalide ou archivée" });
    }

    if (seanceId) {
        if (!mongoose.isValidObjectId(seanceId)) {
            return res.status(400).json({ message: "Séance invalide" });
        }
        const s = await Seance.findById(seanceId);
        if (!s || s.isArchived) {
            return res.status(400).json({ message: "Séance invalide ou archivée" });
        }
        if (s.formationId.toString() !== formationId) {
            return res.status(400).json({
                message: "La séance n’appartient pas à cette formation",
            });
        }
    }

    try {
        const x = await Inscription.create({
            beneficiaireId,
            formationId,
            seanceId,
            status: status || "inscrit",
        });
        res.status(201).json({ inscription: inscriptionPublic(x) });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                message: "Cette inscription existe déjà pour ce bénéficiaire et ce créneau / formation",
            });
        }
        throw err;
    }
}

export async function updateInscription(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const ins = await Inscription.findById(id);
    if (!ins) {
        return res.status(404).json({ message: "Inscription introuvable" });
    }

    const formation = await Formation.findById(ins.formationId);
    if (!formation) {
        return res.status(404).json({ message: "Formation introuvable" });
    }

    if (req.user.role === "referent") {
        const b = await Beneficiaire.findById(ins.beneficiaireId);
        if (
            !b ||
            b.referentId.toString() !== req.user._id.toString()
        ) {
            return res.status(403).json({ message: "Accès refusé" });
        }
    } else if (req.user.role === "formateur") {
        if (formation.trainerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Accès refusé" });
        }
    }

    const { status, attachSeanceId } = req.body;

    const hasAttach =
        attachSeanceId !== undefined &&
        attachSeanceId !== null &&
        attachSeanceId !== "";
    if (status === undefined && !hasAttach) {
        return res.status(400).json({
            message: "Fournir au moins status ou attachSeanceId",
        });
    }

    if (hasAttach) {
        if (!mongoose.isValidObjectId(attachSeanceId)) {
            return res.status(400).json({ message: "attachSeanceId invalide" });
        }
        const s = await Seance.findById(attachSeanceId);
        if (!s || s.isArchived) {
            return res.status(400).json({ message: "Séance invalide" });
        }
        if (s.formationId.toString() !== ins.formationId.toString()) {
            return res.status(400).json({
                message: "La séance ne correspond pas à la formation",
            });
        }
        if (ins.seanceId == null) {
            const dup = await Inscription.findOne({
                beneficiaireId: ins.beneficiaireId,
                formationId: ins.formationId,
                seanceId: attachSeanceId,
                _id: { $ne: ins._id },
            });
            if (dup) {
                return res.status(409).json({
                    message: "Une inscription existe déjà pour ce créneau",
                });
            }
            ins.seanceId = attachSeanceId;
        }
    }

    if (status !== undefined) {
        ins.status = status;
    }

    await ins.save();
    const fresh = await Inscription.findById(ins._id);
    res.json({ inscription: inscriptionPublic(fresh) });
}

export async function deleteInscription(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const x = await Inscription.findById(id);
    if (!x) {
        return res.status(404).json({ message: "Inscription introuvable" });
    }

    if (req.user.role === "referent") {
        const b = await Beneficiaire.findById(x.beneficiaireId);
        if (
            !b ||
            b.referentId.toString() !== req.user._id.toString()
        ) {
            return res.status(403).json({ message: "Accès refusé" });
        }
    }

    await Inscription.findByIdAndDelete(id);
    res.status(204).send();
}
