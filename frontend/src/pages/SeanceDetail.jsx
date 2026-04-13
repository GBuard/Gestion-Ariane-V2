import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin } from "../utils/roles.js";
import { inscriptionsApi } from "../api/inscriptionsApi.js";
import { beneficiairesApi } from "../api/beneficiairesApi.js";
import { seancesApi } from "../api/seancesApi.js";

const STATUS_LABELS = {
    inscrit: "Inscrit",
    present: "Présent(e)",
    absent_excused: "Absent(e) excusé(e)",
    absent: "Absent(e)",
    annule: "Annulé",
};

function canEditPresence(user, row) {
    if (!user || !row?.beneficiaire) return false;
    if (isAdmin(user)) return true;
    if (user.role === "formateur") return true;
    if (
        user.role === "referent" &&
        row.beneficiaire.referentId === user.id
    ) {
        return true;
    }
    return false;
}

export default function SeanceDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const qc = useQueryClient();
    const [newBenefId, setNewBenefId] = useState("");
    const [benefSearch, setBenefSearch] = useState("");
    const [debouncedBenQ, setDebouncedBenQ] = useState("");
    /** single | all | next */
    const [affectMode, setAffectMode] = useState("single");
    const [nextSeancesCount, setNextSeancesCount] = useState(3);
    const [feuilleError, setFeuilleError] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedBenQ(benefSearch.trim()), 300);
        return () => clearTimeout(t);
    }, [benefSearch]);

    const benefListParams = useMemo(() => {
        const p = { sort: "lastName", order: "asc" };
        if (debouncedBenQ) p.q = debouncedBenQ;
        return p;
    }, [debouncedBenQ]);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["seance-detail", id],
        queryFn: async () => {
            const { data: d } = await inscriptionsApi.listBySeance(id);
            return d;
        },
        enabled: Boolean(id),
    });

    const { data: beneficiaires } = useQuery({
        queryKey: ["beneficiaires", "picker", benefListParams],
        queryFn: async () => {
            const { data: d } = await beneficiairesApi.list(benefListParams);
            return d.beneficiaires;
        },
    });

    const enrolledIds = useMemo(
        () => new Set((data?.inscriptions || []).map((i) => i.beneficiaireId)),
        [data?.inscriptions],
    );

    const availableBeneficiaires = useMemo(() => {
        const list = beneficiaires || [];
        return list.filter((b) => !b.isArchived && !enrolledIds.has(b.id));
    }, [beneficiaires, enrolledIds]);

    const canAddInscription =
        user &&
        (isAdmin(user) || user.role === "referent") &&
        data?.seance &&
        !data.seance.isArchived;

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ["seance-detail", id] });
        qc.invalidateQueries({ queryKey: ["seances"] });
        qc.invalidateQueries({ queryKey: ["seances", "calendar"] });
    };

    const updateMut = useMutation({
        mutationFn: ({ inscriptionId, body }) =>
            inscriptionsApi.update(inscriptionId, body),
        onSuccess: invalidate,
    });

    const [bulkMessage, setBulkMessage] = useState(null);

    const bulkMut = useMutation({
        mutationFn: (body) => inscriptionsApi.bulk(body),
        onSuccess: (res) => {
            invalidate();
            setNewBenefId("");
            setBulkMessage(null);
            const skipped = res?.data?.skippedSeanceIds?.length ?? 0;
            const count = res?.data?.count;
            if (skipped > 0) {
                setBulkMessage(
                    `${count ?? 0} inscription(s) créée(s). ${skipped} créneau(x) déjà couvert(s), ignoré(s).`,
                );
            } else if (typeof count === "number") {
                setBulkMessage(`${count} inscription(s) créée(s).`);
            }
        },
    });

    const setPresence = (row, status) => {
        const body = { status };
        if (row.seanceId == null) {
            body.attachSeanceId = id;
        }
        updateMut.mutate({ inscriptionId: row.id, body });
    };

    const handleAddInscription = (e) => {
        e.preventDefault();
        setBulkMessage(null);
        if (!newBenefId || !data?.seance) return;
        const body = {
            beneficiaireId: newBenefId,
            formationId: data.seance.formationId,
            status: "inscrit",
        };
        if (affectMode === "all") {
            body.allSeances = true;
        } else if (affectMode === "next") {
            body.nextSeancesCount = Math.min(
                100,
                Math.max(1, Number(nextSeancesCount) || 1),
            );
        } else {
            body.seanceId = id;
        }
        bulkMut.mutate(body);
    };

    const openFeuilleEmargement = async () => {
        setFeuilleError(null);
        try {
            const res = await seancesApi.feuilleEmargement(id);
            const blob = new Blob([res.data], {
                type: "text/html;charset=utf-8",
            });
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener,noreferrer");
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (err) {
            setFeuilleError(
                err?.response?.data?.message ||
                    "Impossible d’ouvrir la feuille d’émargement.",
            );
        }
    };

    if (isLoading) {
        return <p className="text-slate-600">Chargement…</p>;
    }
    if (isError || !data) {
        return (
            <p className="text-red-600">
                Séance introuvable ou accès refusé.{" "}
                <Link to="/calendrier" className="underline">
                    Retour au calendrier
                </Link>
            </p>
        );
    }

    const { seance, formationTitle, salleName, inscriptions } = data;

    return (
        <div>
            <div className="mb-6">
                <Link
                    to="/calendrier"
                    className="text-sm text-slate-600 hover:underline"
                >
                    ← Calendrier
                </Link>
                <Link
                    to="/seances"
                    className="text-sm text-slate-600 hover:underline ml-4"
                >
                    Liste des séances
                </Link>
            </div>

            <h1 className="text-2xl font-semibold text-slate-900">
                {formationTitle}
            </h1>
            <p className="text-slate-600 mt-1">
                {new Date(seance.startDate).toLocaleString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                })}{" "}
                →{" "}
                {new Date(seance.endDate).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                })}
                {salleName ? (
                    <>
                        {" "}
                        · Salle <span className="font-medium">{salleName}</span>
                    </>
                ) : null}
            </p>
            {seance.notes ? (
                <p className="text-sm text-slate-500 mt-2">{seance.notes}</p>
            ) : null}

            <div className="mt-4">
                <button
                    type="button"
                    onClick={() => openFeuilleEmargement()}
                    className="rounded-md border border-slate-300 bg-white text-slate-800 text-sm px-4 py-2 hover:bg-slate-50"
                >
                    Feuille d’émargement (aperçu / impression)
                </button>
                {feuilleError ? (
                    <p className="text-sm text-red-600 mt-2">{feuilleError}</p>
                ) : null}
            </div>

            {canAddInscription ? (
                <form
                    onSubmit={handleAddInscription}
                    className="mt-6 space-y-3 bg-white border border-slate-200 rounded-lg p-4 shadow-sm"
                >
                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Rechercher un bénéficiaire
                            </label>
                            <input
                                type="search"
                                value={benefSearch}
                                onChange={(e) => setBenefSearch(e.target.value)}
                                placeholder="Nom, prénom ou email…"
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="min-w-[220px]">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Bénéficiaire
                            </label>
                            <select
                                value={newBenefId}
                                onChange={(e) => setNewBenefId(e.target.value)}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            >
                                <option value="">— Choisir —</option>
                                {availableBeneficiaires.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.firstName} {b.lastName}
                                        {b.email ? ` · ${b.email}` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="submit"
                            disabled={
                                !newBenefId ||
                                bulkMut.isPending ||
                                availableBeneficiaires.length === 0
                            }
                            className="rounded-md bg-slate-900 text-white text-sm px-4 py-2 disabled:opacity-50"
                        >
                            {affectMode === "all"
                                ? "Inscrire (toutes les séances)"
                                : affectMode === "next"
                                  ? `Inscrire (${nextSeancesCount} prochaine(s))`
                                  : "Inscrire à cette séance"}
                        </button>
                    </div>
                    <fieldset className="space-y-2 text-sm text-slate-700">
                        <legend className="sr-only">Portée de l’inscription</legend>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="affectMode"
                                className="border-slate-300"
                                checked={affectMode === "single"}
                                onChange={() => setAffectMode("single")}
                            />
                            Cette séance uniquement
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="affectMode"
                                className="border-slate-300"
                                checked={affectMode === "next"}
                                onChange={() => setAffectMode("next")}
                            />
                            Les
                            <input
                                type="number"
                                min={1}
                                max={100}
                                value={nextSeancesCount}
                                onChange={(e) =>
                                    setNextSeancesCount(
                                        Number(e.target.value) || 1,
                                    )
                                }
                                disabled={affectMode !== "next"}
                                className="w-16 rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                            />
                            prochaine(s) séance(s) de la formation
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="affectMode"
                                className="border-slate-300"
                                checked={affectMode === "all"}
                                onChange={() => setAffectMode("all")}
                            />
                            Toutes les séances de la formation
                        </label>
                    </fieldset>
                    {bulkMessage ? (
                        <p className="text-sm text-emerald-700">{bulkMessage}</p>
                    ) : null}
                    {bulkMut.isError ? (
                        <span className="text-sm text-red-600">
                            {bulkMut.error?.response?.data?.message ||
                                "Impossible d’inscrire (déjà inscrit ou erreur)."}
                        </span>
                    ) : null}
                </form>
            ) : null}

            <h2 className="text-lg font-medium text-slate-900 mt-8 mb-3">
                Inscrits ({inscriptions.length})
            </h2>
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left">
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Bénéficiaire
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Statut
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Présence
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {inscriptions.map((row) => (
                            <tr
                                key={row.id}
                                className="border-b border-slate-100"
                            >
                                <td className="px-4 py-3">
                                    {row.beneficiaire ? (
                                        <>
                                            {row.beneficiaire.firstName}{" "}
                                            {row.beneficiaire.lastName}
                                        </>
                                    ) : (
                                        row.beneficiaireId
                                    )}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {STATUS_LABELS[row.status] || row.status}
                                </td>
                                <td className="px-4 py-3">
                                    {canEditPresence(user, row) ? (
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                className="rounded border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs px-2 py-1 hover:bg-emerald-100"
                                                disabled={updateMut.isPending}
                                                onClick={() =>
                                                    setPresence(row, "present")
                                                }
                                            >
                                                Présent(e)
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded border border-amber-200 bg-amber-50 text-amber-900 text-xs px-2 py-1 hover:bg-amber-100"
                                                disabled={updateMut.isPending}
                                                onClick={() =>
                                                    setPresence(
                                                        row,
                                                        "absent_excused",
                                                    )
                                                }
                                            >
                                                Absent(e) excusé(e)
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded border border-red-200 bg-red-50 text-red-900 text-xs px-2 py-1 hover:bg-red-100"
                                                disabled={updateMut.isPending}
                                                onClick={() =>
                                                    setPresence(row, "absent")
                                                }
                                            >
                                                Absent(e)
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-slate-400 text-xs">
                                            Lecture seule
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!inscriptions.length ? (
                    <p className="p-6 text-slate-500">
                        Aucun inscrit pour cette séance.
                    </p>
                ) : null}
            </div>
        </div>
    );
}
