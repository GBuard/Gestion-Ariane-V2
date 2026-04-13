import { Formation } from "../models/Formation.js";

/**
 * Limite les séances aux formations dont l’utilisateur est l’intervenant (formateur).
 * Modifie `filter` en place (formationId). Sans effet si le rôle n’est pas formateur.
 */
export async function applyFormateurSeanceScope(filter, user) {
    if (!user || user.role !== "formateur") {
        return;
    }

    const rows = await Formation.find({
        trainerId: user._id,
        isArchived: false,
    })
        .select("_id")
        .lean();
    const ids = rows.map((r) => r._id);

    if (!ids.length) {
        filter._id = { $in: [] };
        return;
    }

    if (!filter.formationId) {
        filter.formationId = { $in: ids };
        return;
    }

    const cur = filter.formationId;
    if (cur && typeof cur === "object" && Array.isArray(cur.$in)) {
        const allowed = new Set(ids.map((i) => i.toString()));
        const next = cur.$in.filter((id) => allowed.has(id.toString()));
        filter.formationId = next.length ? { $in: next } : { $in: [] };
    } else {
        const ok = ids.some((id) => id.toString() === cur.toString());
        filter.formationId = ok ? cur : { $in: [] };
    }
}
