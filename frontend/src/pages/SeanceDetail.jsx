import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin } from "../utils/roles.js";
import { inscriptionsApi } from "../api/inscriptionsApi.js";
import { beneficiairesApi } from "../api/beneficiairesApi.js";
import { seancesApi } from "../api/seancesApi.js";
import { usersApi } from "../api/usersApi.js";

const STATUS_LABELS = {
    inscrit: "Inscrit",
    present: "Présent(e)",
    absent_excused: "Absent(e) excusé(e)",
    absent: "Absent(e)",
    annule: "Annulé",
};

const benefCreateSchema = z.object({
    firstName: z.string().min(1, "Requis"),
    lastName: z.string().min(1, "Requis"),
    email: z.union([z.literal(""), z.string().email("Email invalide")]),
    phone: z.string(),
    notes: z.string(),
    referentId: z.string().optional(),
});

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

function canRemoveFromSeance(user, row) {
    if (!user || !row) return false;
    if (isAdmin(user)) return true;
    if (
        user.role === "referent" &&
        row.beneficiaire?.referentId === user.id
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
    const [inscriptionMessage, setInscriptionMessage] = useState("");
    const [feuilleError, setFeuilleError] = useState(null);
    const [absentFeedback, setAbsentFeedback] = useState(null);
    const [showCreateBenef, setShowCreateBenef] = useState(false);
    const [createBenefError, setCreateBenefError] = useState("");
    const [duplicates, setDuplicates] = useState([]);
    const admin = isAdmin(user);

    const {
        register: registerBenef,
        handleSubmit: handleSubmitBenef,
        reset: resetBenef,
        formState: { errors: benefErrors },
    } = useForm({
        resolver: zodResolver(benefCreateSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            notes: "",
            referentId: "",
        },
    });

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

    const { data: usersData } = useQuery({
        queryKey: ["users"],
        queryFn: async () => {
            const { data: d } = await usersApi.list();
            return d.users;
        },
        enabled: admin && showCreateBenef,
    });

    const referents = useMemo(
        () =>
            (usersData || []).filter(
                (u) => u.role === "referent" && u.isActive !== false,
            ),
        [usersData],
    );

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
        !data.seance.isArchived &&
        !data.seance.trainerAbsent;

    const canMarkTrainerAbsent =
        user &&
        data?.seance &&
        !data.seance.isArchived &&
        (isAdmin(user) ||
            (user.role === "formateur" &&
                data.formationTrainerId === user.id));

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
            setInscriptionMessage("");
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

    const removeMut = useMutation({
        mutationFn: ({ inscriptionId }) =>
            inscriptionsApi.removeFromSeance(inscriptionId, id),
        onSuccess: () => {
            invalidate();
            setBulkMessage("Bénéficiaire retiré de cette séance.");
        },
    });

    const createBenefMut = useMutation({
        mutationFn: (body) => beneficiairesApi.create(body),
        onSuccess: (res) => {
            const created = res?.data?.beneficiaire;
            qc.invalidateQueries({ queryKey: ["beneficiaires"] });
            setShowCreateBenef(false);
            setDuplicates([]);
            setCreateBenefError("");
            resetBenef({
                firstName: "",
                lastName: "",
                email: "",
                phone: "",
                notes: "",
                referentId: "",
            });
            if (created?.id) {
                setNewBenefId(created.id);
                setBulkMessage(
                    `Bénéficiaire créé : ${created.firstName} ${created.lastName}. Vous pouvez l’inscrire ci-dessous.`,
                );
            }
        },
    });

    const openCreateBenef = () => {
        setShowCreateBenef(true);
        setCreateBenefError("");
        setDuplicates([]);
        resetBenef({
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            notes: "",
            referentId: admin ? referents[0]?.id || "" : user?.id || "",
        });
    };

    const submitCreateBenef = async (values, force = false) => {
        setCreateBenefError("");
        setDuplicates([]);
        const body = {
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email || undefined,
            phone: values.phone || undefined,
            notes: values.notes || undefined,
            referentId: admin ? values.referentId : user?.id,
            force,
        };
        if (admin && !body.referentId) {
            setCreateBenefError("Référent requis.");
            return;
        }
        try {
            await createBenefMut.mutateAsync(body);
        } catch (err) {
            const d = err?.response?.data;
            if (
                err?.response?.status === 409 &&
                d?.code === "POSSIBLE_DUPLICATE"
            ) {
                setDuplicates(d.duplicates || []);
                setCreateBenefError(
                    d.message ||
                        "Doublon possible. Choisissez un existant ou forcez la création.",
                );
                return;
            }
            setCreateBenefError(
                d?.message || "Impossible de créer le bénéficiaire.",
            );
        }
    };

    const handleRemoveFromSeance = (row) => {
        const name = row.beneficiaire
            ? `${row.beneficiaire.firstName} ${row.beneficiaire.lastName}`
            : "ce bénéficiaire";
        const warn =
            row.seanceId == null
                ? `« ${name} » est inscrit à toute la formation. Le retirer de cette séance le retirera de celle-ci uniquement (les autres séances actives resteront couvertes). Continuer ?`
                : `Retirer « ${name} » de cette séance ?`;
        if (!confirm(warn)) return;
        removeMut.mutate({ inscriptionId: row.id });
    };

    const absentMut = useMutation({
        mutationFn: (body) => seancesApi.setTrainerAbsent(id, body),
        onSuccess: (res) => {
            invalidate();
            const d = res?.data;
            if (!d) {
                setAbsentFeedback(null);
                return;
            }
            if (!d.seance?.trainerAbsent) {
                setAbsentFeedback("Absence formateur annulée.");
                return;
            }
            const parts = ["Séance marquée : formateur absent."];
            if (d.noNextSeance) {
                parts.push(
                    "Aucune séance suivante disponible pour le report.",
                );
            } else if (typeof d.reportedCount === "number") {
                parts.push(
                    `${d.reportedCount} bénéficiaire(s) reporté(s) sur la prochaine séance.`,
                );
                if (d.skippedAlreadyOnNext > 0) {
                    parts.push(
                        `${d.skippedAlreadyOnNext} déjà inscrit(s) sur cette prochaine séance.`,
                    );
                }
                if (d.nextSeanceStart) {
                    parts.push(
                        `Prochaine séance : ${new Date(
                            d.nextSeanceStart,
                        ).toLocaleString("fr-FR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                        })}.`,
                    );
                }
            }
            setAbsentFeedback(parts.join(" "));
        },
    });

    const handleToggleTrainerAbsent = () => {
        setAbsentFeedback(null);
        if (!data?.seance) return;

        if (data.seance.trainerAbsent) {
            if (
                !confirm(
                    "Retirer le marquage « formateur absent » pour cette séance ? Les reports déjà effectués ne seront pas annulés.",
                )
            ) {
                return;
            }
            absentMut.mutate({
                trainerAbsent: false,
                reportBeneficiaires: false,
            });
            return;
        }

        const n = data.inscriptions?.length ?? 0;
        const ok = confirm(
            n > 0
                ? `Marquer cette séance comme « formateur absent » (grisée au calendrier) et reporter les inscrits de ce créneau vers la prochaine séance de la formation ?\n\n${n} personne(s) visible(s) sur cette séance.`
                : "Marquer cette séance comme « formateur absent » (grisée au calendrier) ?",
        );
        if (!ok) return;

        absentMut.mutate({
            trainerAbsent: true,
            reportBeneficiaires: true,
        });
    };

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
            message: inscriptionMessage.trim() || undefined,
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

            {seance.trainerAbsent ? (
                <p className="mt-3 inline-flex items-center rounded-md bg-slate-200 text-slate-800 text-sm font-medium px-3 py-1.5">
                    Formateur absent — séance annulée / grisée au calendrier
                </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-3 items-center">
                <button
                    type="button"
                    onClick={() => openFeuilleEmargement()}
                    className="rounded-md border border-slate-300 bg-white text-slate-800 text-sm px-4 py-2 hover:bg-slate-50"
                >
                    Feuille d’émargement (aperçu / impression)
                </button>
                {canMarkTrainerAbsent ? (
                    <label className="inline-flex items-center gap-2 text-sm text-slate-800 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            className="rounded border-slate-300"
                            checked={Boolean(seance.trainerAbsent)}
                            disabled={absentMut.isPending}
                            onChange={handleToggleTrainerAbsent}
                        />
                        Formateur absent
                    </label>
                ) : null}
            </div>
            {feuilleError ? (
                <p className="text-sm text-red-600 mt-2">{feuilleError}</p>
            ) : null}
            {absentFeedback ? (
                <p className="text-sm text-emerald-700 mt-2">{absentFeedback}</p>
            ) : null}
            {absentMut.isError ? (
                <p className="text-sm text-red-600 mt-2">
                    {absentMut.error?.response?.data?.message ||
                        "Impossible de mettre à jour l’absence formateur."}
                </p>
            ) : null}

            {canAddInscription ? (
                <div className="mt-6 space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={openCreateBenef}
                            className="rounded-md border border-slate-300 bg-white text-slate-800 text-sm px-4 py-2 hover:bg-slate-50"
                        >
                            Nouveau bénéficiaire
                        </button>
                    </div>

                    {showCreateBenef ? (
                        <form
                            onSubmit={handleSubmitBenef((v) =>
                                submitCreateBenef(v, false),
                            )}
                            className="space-y-3 bg-white border border-slate-200 rounded-lg p-4 shadow-sm"
                        >
                            <h3 className="font-medium text-slate-900">
                                Créer un bénéficiaire
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">
                                        Prénom
                                    </label>
                                    <input
                                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                        {...registerBenef("firstName")}
                                    />
                                    {benefErrors.firstName ? (
                                        <p className="text-sm text-red-600 mt-1">
                                            {benefErrors.firstName.message}
                                        </p>
                                    ) : null}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">
                                        Nom
                                    </label>
                                    <input
                                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                        {...registerBenef("lastName")}
                                    />
                                    {benefErrors.lastName ? (
                                        <p className="text-sm text-red-600 mt-1">
                                            {benefErrors.lastName.message}
                                        </p>
                                    ) : null}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                        {...registerBenef("email")}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">
                                        Téléphone
                                    </label>
                                    <input
                                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                        {...registerBenef("phone")}
                                    />
                                </div>
                                {admin ? (
                                    <div className="md:col-span-2">
                                        <label className="text-sm font-medium text-slate-700">
                                            Référent
                                        </label>
                                        <select
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            {...registerBenef("referentId")}
                                        >
                                            <option value="">— Choisir —</option>
                                            {referents.map((r) => (
                                                <option key={r.id} value={r.id}>
                                                    {r.firstName} {r.lastName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ) : null}
                                <div className="md:col-span-2">
                                    <label className="text-sm font-medium text-slate-700">
                                        Notes
                                    </label>
                                    <textarea
                                        rows={2}
                                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                        {...registerBenef("notes")}
                                    />
                                </div>
                            </div>
                            {createBenefError ? (
                                <p className="text-sm text-amber-800">
                                    {createBenefError}
                                </p>
                            ) : null}
                            {duplicates.length > 0 ? (
                                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm space-y-2">
                                    <p className="font-medium text-amber-950">
                                        Correspondances existantes :
                                    </p>
                                    <ul className="space-y-1">
                                        {duplicates.map((d) => (
                                            <li
                                                key={d.id}
                                                className="flex flex-wrap items-center justify-between gap-2"
                                            >
                                                <span>
                                                    {d.firstName} {d.lastName}
                                                    {d.email
                                                        ? ` · ${d.email}`
                                                        : ""}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="text-slate-800 underline"
                                                    onClick={() => {
                                                        setNewBenefId(d.id);
                                                        setShowCreateBenef(
                                                            false,
                                                        );
                                                        setDuplicates([]);
                                                        setCreateBenefError("");
                                                        setBulkMessage(
                                                            `Bénéficiaire sélectionné : ${d.firstName} ${d.lastName}.`,
                                                        );
                                                    }}
                                                >
                                                    Utiliser celui-ci
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                    <button
                                        type="button"
                                        className="rounded-md bg-amber-900 text-white text-xs px-3 py-1.5"
                                        disabled={createBenefMut.isPending}
                                        onClick={handleSubmitBenef((v) =>
                                            submitCreateBenef(v, true),
                                        )}
                                    >
                                        Créer quand même un nouveau
                                    </button>
                                </div>
                            ) : null}
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    disabled={createBenefMut.isPending}
                                    className="rounded-md bg-slate-900 text-white text-sm px-4 py-2 disabled:opacity-50"
                                >
                                    Enregistrer
                                </button>
                                <button
                                    type="button"
                                    className="rounded-md border border-slate-300 text-sm px-4 py-2"
                                    onClick={() => {
                                        setShowCreateBenef(false);
                                        setDuplicates([]);
                                        setCreateBenefError("");
                                    }}
                                >
                                    Annuler
                                </button>
                            </div>
                        </form>
                    ) : null}

                <form
                    onSubmit={handleAddInscription}
                    className="space-y-3 bg-white border border-slate-200 rounded-lg p-4 shadow-sm"
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
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Message (optionnel)
                        </label>
                        <textarea
                            value={inscriptionMessage}
                            onChange={(e) =>
                                setInscriptionMessage(e.target.value)
                            }
                            rows={2}
                            maxLength={1000}
                            placeholder="Info utile pour le formateur (contexte, besoin particulier…)"
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
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
                </div>
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
                                Référent
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Message
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Statut
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Présence
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700 w-28">
                                Actions
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
                                    {row.beneficiaire?.referentName || "—"}
                                </td>
                                <td className="px-4 py-3 text-slate-600 max-w-xs">
                                    {row.message ? (
                                        <span className="whitespace-pre-wrap">
                                            {row.message}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">—</span>
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
                                <td className="px-4 py-3">
                                    {canRemoveFromSeance(user, row) ? (
                                        <button
                                            type="button"
                                            className="text-red-700 hover:underline text-xs"
                                            disabled={removeMut.isPending}
                                            onClick={() =>
                                                handleRemoveFromSeance(row)
                                            }
                                        >
                                            Retirer
                                        </button>
                                    ) : (
                                        <span className="text-slate-300">—</span>
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
