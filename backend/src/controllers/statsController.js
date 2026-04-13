import mongoose from "mongoose";
import { fromZonedTime } from "date-fns-tz";
import { Beneficiaire } from "../models/Beneficiaire.js";
import { Formation } from "../models/Formation.js";
import { User } from "../models/User.js";
import { Salle } from "../models/Salle.js";
import { Seance } from "../models/Seance.js";
import { Inscription } from "../models/Inscription.js";
import { inscriptionPublic } from "../utils/inscriptionPublic.js";
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

const now = () => new Date();

export async function getDashboard(req, res) {
    const role = req.user.role;
    const userId = req.user._id;

    let beneficiairesTotal;
    let formationsActives;
    let seancesAVenir;
    let sallesTotal;
    let recentFilter = {};

    if (role === "admin") {
        beneficiairesTotal = await Beneficiaire.countDocuments({
            isArchived: false,
        });
        formationsActives = await Formation.countDocuments({
            isArchived: false,
        });
        seancesAVenir = await Seance.countDocuments({
            isArchived: false,
            endDate: { $gt: now() },
        });
        sallesTotal = await Salle.countDocuments({ isArchived: false });
        recentFilter = {};
    } else if (role === "referent") {
        const ids = await beneficiaireIdsForReferent(userId);
        beneficiairesTotal = await Beneficiaire.countDocuments({
            referentId: userId,
            isArchived: false,
        });
        formationsActives = await Formation.countDocuments({
            isArchived: false,
        });
        seancesAVenir = await Seance.countDocuments({
            isArchived: false,
            endDate: { $gt: now() },
        });
        sallesTotal = await Salle.countDocuments({ isArchived: false });
        recentFilter =
            ids.length > 0
                ? { beneficiaireId: { $in: ids } }
                : { _id: { $in: [] } };
    } else {
        const fIds = await formationIdsForFormateur(userId);
        const distinctB = await Inscription.distinct("beneficiaireId", {
            formationId: { $in: fIds },
        });
        beneficiairesTotal = distinctB.length;
        formationsActives = await Formation.countDocuments({
            trainerId: userId,
            isArchived: false,
        });
        seancesAVenir =
            fIds.length > 0
                ? await Seance.countDocuments({
                      isArchived: false,
                      endDate: { $gt: now() },
                      formationId: { $in: fIds },
                  })
                : 0;
        sallesTotal = await Salle.countDocuments({ isArchived: false });
        recentFilter =
            fIds.length > 0
                ? { formationId: { $in: fIds } }
                : { _id: { $in: [] } };
    }

    const recentDocs = await Inscription.find(recentFilter)
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

    const benIds = [
        ...new Set(
            recentDocs
                .map((r) => r.beneficiaireId?.toString?.())
                .filter(Boolean),
        ),
    ];
    const formIds = [
        ...new Set(
            recentDocs
                .map((r) => r.formationId?.toString?.())
                .filter(Boolean),
        ),
    ];

    const [bens, forms] = await Promise.all([
        benIds.length
            ? Beneficiaire.find({ _id: { $in: benIds } })
                  .select("firstName lastName")
                  .lean()
            : [],
        formIds.length
            ? Formation.find({ _id: { $in: formIds } }).select("title").lean()
            : [],
    ]);

    const bMap = new Map(bens.map((b) => [b._id.toString(), b]));
    const fMap = new Map(forms.map((f) => [f._id.toString(), f]));

    const inscriptionsRecentes = recentDocs
        .filter((row) => row && row._id)
        .map((row) => {
            const bid = row.beneficiaireId?.toString?.();
            const fid = row.formationId?.toString?.();
            const b = bid ? bMap.get(bid) : null;
            const f = fid ? fMap.get(fid) : null;
            return {
                ...inscriptionPublic(row),
                beneficiaireName: b ? `${b.firstName} ${b.lastName}` : null,
                formationTitle: f?.title ?? null,
            };
        });

    res.json({
        beneficiairesTotal,
        formationsActives,
        seancesAVenir,
        sallesTotal,
        inscriptionsRecentes,
    });
}

export async function getGlobal(req, res) {
    const role = req.user.role;
    const userId = req.user._id;

    let matchInscriptions = {};
    let beneficiaires;
    let formations;
    let seances;
    let inscriptions;

    if (role === "admin") {
        beneficiaires = await Beneficiaire.countDocuments({
            isArchived: false,
        });
        formations = await Formation.countDocuments({ isArchived: false });
        seances = await Seance.countDocuments({ isArchived: false });
        inscriptions = await Inscription.countDocuments();
        matchInscriptions = {};
    } else if (role === "referent") {
        const ids = await beneficiaireIdsForReferent(userId);
        beneficiaires = await Beneficiaire.countDocuments({
            referentId: userId,
            isArchived: false,
        });
        matchInscriptions =
            ids.length > 0
                ? { beneficiaireId: { $in: ids } }
                : { _id: { $in: [] } };
        inscriptions = await Inscription.countDocuments(matchInscriptions);
        const formationIds = await Inscription.distinct(
            "formationId",
            matchInscriptions,
        );
        formations = formationIds.length;
        seances = await Seance.countDocuments({ isArchived: false });
    } else {
        const fIds = await formationIdsForFormateur(userId);
        const distinctB = await Inscription.distinct("beneficiaireId", {
            formationId: { $in: fIds },
        });
        beneficiaires = distinctB.length;
        formations = await Formation.countDocuments({
            trainerId: userId,
            isArchived: false,
        });
        seances =
            fIds.length > 0
                ? await Seance.countDocuments({
                      isArchived: false,
                      formationId: { $in: fIds },
                  })
                : 0;
        matchInscriptions =
            fIds.length > 0
                ? { formationId: { $in: fIds } }
                : { _id: { $in: [] } };
        inscriptions = await Inscription.countDocuments(matchInscriptions);
    }

    const pipeline = [
        { $match: matchInscriptions },
        {
            $match: {
                formationId: { $exists: true, $ne: null },
            },
        },
        {
            $group: {
                _id: "$formationId",
                inscriptionCount: { $sum: 1 },
            },
        },
        {
            $lookup: {
                from: "formations",
                localField: "_id",
                foreignField: "_id",
                as: "formation",
            },
        },
        { $unwind: "$formation" },
        {
            $project: {
                _id: 0,
                formationId: { $toString: "$_id" },
                title: "$formation.title",
                inscriptionCount: 1,
            },
        },
        { $sort: { inscriptionCount: -1 } },
    ];

    const repartitionParFormation = await Inscription.aggregate(pipeline);

    res.json({
        beneficiaires,
        formations,
        seances,
        inscriptions,
        repartitionParFormation,
    });
}

const PARIS_TZ = "Europe/Paris";

function parseWorkshopsPeriod(req) {
    const { from, to, month } = req.query;
    if (month && /^\d{4}-\d{2}$/.test(String(month))) {
        const [Y, M] = String(month).split("-").map(Number);
        const lastDay = new Date(Date.UTC(Y, M, 0)).getUTCDate();
        const mm = String(M).padStart(2, "0");
        const start = fromZonedTime(`${Y}-${mm}-01T00:00:00`, PARIS_TZ);
        const end = fromZonedTime(
            `${Y}-${mm}-${String(lastDay).padStart(2, "0")}T23:59:59.999`,
            PARIS_TZ,
        );
        return { start, end };
    }
    if (
        from &&
        to &&
        /^\d{4}-\d{2}-\d{2}$/.test(String(from)) &&
        /^\d{4}-\d{2}-\d{2}$/.test(String(to))
    ) {
        const start = fromZonedTime(`${from}T00:00:00`, PARIS_TZ);
        const end = fromZonedTime(`${to}T23:59:59.999`, PARIS_TZ);
        return { start, end };
    }
    return null;
}

export async function getWorkshopsStats(req, res) {
    const range = parseWorkshopsPeriod(req);
    if (!range) {
        return res.status(400).json({
            message:
                "Fournir month=YYYY-MM ou les paramètres from et to (YYYY-MM-DD)",
        });
    }
    const { start, end } = range;
    if (end < start) {
        return res.status(400).json({ message: "Période invalide" });
    }

    const seancesInRange = await Seance.find({
        isArchived: false,
        startDate: { $gte: start, $lte: end },
    })
        .select("formationId _id")
        .lean();

    const formationIds = [
        ...new Set(seancesInRange.map((s) => s.formationId.toString())),
    ];
    const seanceIds = seancesInRange.map((s) => s._id);

    const oidFormationIds = formationIds.map(
        (id) => new mongoose.Types.ObjectId(id),
    );

    const inscForReferent =
        formationIds.length && seanceIds.length
            ? await Inscription.find({
                  $or: [
                      { seanceId: { $in: seanceIds } },
                      {
                          seanceId: null,
                          formationId: { $in: oidFormationIds },
                      },
                  ],
              })
                  .select("beneficiaireId")
                  .lean()
            : [];

    const benIds = [
        ...new Set(
            inscForReferent
                .map((i) => i.beneficiaireId?.toString())
                .filter(Boolean),
        ),
    ];
    const bens = benIds.length
        ? await Beneficiaire.find({ _id: { $in: benIds } })
              .select("referentId")
              .lean()
        : [];
    const benToRef = new Map(
        bens.map((b) => [b._id.toString(), b.referentId.toString()]),
    );

    const refToBen = new Map();
    for (const row of inscForReferent) {
        const bid = row.beneficiaireId?.toString();
        const rid = bid ? benToRef.get(bid) : null;
        if (!rid || !bid) continue;
        if (!refToBen.has(rid)) refToBen.set(rid, new Set());
        refToBen.get(rid).add(bid);
    }

    const referentIds = [...refToBen.keys()];
    const refUsers = referentIds.length
        ? await User.find({ _id: { $in: referentIds } })
              .select("firstName lastName email")
              .lean()
        : [];
    const refMap = new Map(refUsers.map((u) => [u._id.toString(), u]));

    const referentPlacements = referentIds
        .map((rid) => {
            const u = refMap.get(rid);
            const set = refToBen.get(rid);
            return {
                referentId: rid,
                name: u ? `${u.firstName} ${u.lastName}` : "—",
                email: u?.email ?? null,
                beneficiairesPlaces: set ? set.size : 0,
            };
        })
        .sort((a, b) => b.beneficiairesPlaces - a.beneficiairesPlaces);

    const formations = formationIds.length
        ? await Formation.find({ _id: { $in: oidFormationIds } })
              .select("title")
              .lean()
        : [];
    const fMap = new Map(formations.map((f) => [f._id.toString(), f.title]));

    const byFormation = new Map();
    for (const s of seancesInRange) {
        const fid = s.formationId.toString();
        const raw = await Inscription.find({
            formationId: s.formationId,
            $or: [{ seanceId: s._id }, { seanceId: null }],
        }).lean();
        const merged = mergeInscriptionsForSeance(raw, s._id.toString());
        let enrolled = 0;
        let present = 0;
        for (const row of merged) {
            if (row.status === "annule") continue;
            enrolled += 1;
            if (row.status === "present") present += 1;
        }
        const pct = enrolled ? Math.round((100 * present) / enrolled) : null;
        const cur = byFormation.get(fid) || {
            title: fMap.get(fid) || "—",
            sum: 0,
            n: 0,
        };
        if (pct != null) {
            cur.sum += pct;
            cur.n += 1;
        }
        byFormation.set(fid, cur);
    }

    const formationsPresence = [...byFormation.entries()].map(
        ([formationId, v]) => ({
            formationId,
            title: v.title,
            seancesCount: v.n,
            avgPresencePercent: v.n ? Math.round(v.sum / v.n) : null,
        }),
    );

    res.json({
        start: start.toISOString(),
        end: end.toISOString(),
        referentPlacements,
        formationsPresence,
    });
}
