import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin } from "../utils/roles.js";
import { seancesApi } from "../api/seancesApi.js";
import { formationsApi } from "../api/formationsApi.js";
import { sallesApi } from "../api/sallesApi.js";

function toLocalInput(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const h = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${y}-${m}-${day}T${h}:${min}`;
}

const formSchema = z
    .object({
        formationId: z.string().min(1, "Formation requise"),
        salleId: z.string().min(1, "Salle requise"),
        startDate: z.string().min(1, "Début requis"),
        endDate: z.string().min(1, "Fin requis"),
        capacity: z.string(),
        notes: z.string(),
    })
    .superRefine((data, ctx) => {
        if (data.capacity === "" || data.capacity === undefined) return;
        const n = Number(data.capacity);
        if (!Number.isInteger(n) || n < 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["capacity"],
                message: "Entier ≥ 1 ou laisser vide",
            });
        }
    });

export default function Seances() {
    const { user } = useAuth();
    const admin = isAdmin(user);
    const qc = useQueryClient();
    const [editing, setEditing] = useState(null);
    const [listQ, setListQ] = useState("");
    const [debouncedQ, setDebouncedQ] = useState("");
    const [formationFilter, setFormationFilter] = useState("");
    const [sortField, setSortField] = useState("startDate");
    const [listIncludeArchived, setListIncludeArchived] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(listQ.trim()), 300);
        return () => clearTimeout(t);
    }, [listQ]);

    const listParams = useMemo(() => {
        const p = {};
        if (debouncedQ) p.q = debouncedQ;
        if (formationFilter) p.formationId = formationFilter;
        if (sortField === "startDate_desc") p.sort = "startDate_desc";
        else if (sortField === "formationTitle") p.sort = "formationTitle";
        else if (sortField === "formationTitle_desc")
            p.sort = "formationTitle_desc";
        else p.sort = "startDate";
        if (admin && listIncludeArchived) {
            p.includeArchived = true;
        }
        return p;
    }, [admin, debouncedQ, formationFilter, listIncludeArchived, sortField]);

    const {
        data: seances,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ["seances", listParams],
        queryFn: async () => {
            const { data: d } = await seancesApi.list(listParams);
            return d.seances;
        },
    });

    const { data: formations } = useQuery({
        queryKey: ["formations"],
        queryFn: async () => {
            const { data: d } = await formationsApi.list();
            return d.formations;
        },
    });

    const { data: salles } = useQuery({
        queryKey: ["salles"],
        queryFn: async () => {
            const { data: d } = await sallesApi.list();
            return d.salles;
        },
    });

    const activeFormations = formations?.filter((f) => !f.isArchived) ?? [];
    const activeSalles = salles?.filter((s) => !s.isArchived) ?? [];

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            formationId: "",
            salleId: "",
            startDate: "",
            endDate: "",
            capacity: "",
            notes: "",
        },
    });

    const createMut = useMutation({
        mutationFn: (body) => seancesApi.create(body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["seances"] });
            setEditing(null);
            reset();
        },
    });

    const updateMut = useMutation({
        mutationFn: ({ id, body }) => seancesApi.update(id, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["seances"] });
            setEditing(null);
            reset();
        },
    });

    const archiveMut = useMutation({
        mutationFn: (id) => seancesApi.archive(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["seances"] }),
    });

    const toApiBody = (values) => ({
        formationId: values.formationId,
        salleId: values.salleId,
        startDate: new Date(values.startDate).toISOString(),
        endDate: new Date(values.endDate).toISOString(),
        capacity:
            values.capacity === "" || values.capacity === undefined
                ? null
                : Number(values.capacity),
        notes: values.notes || "",
    });

    const openCreate = () => {
        setEditing("new");
        reset({
            formationId: activeFormations[0]?.id || "",
            salleId: activeSalles[0]?.id || "",
            startDate: "",
            endDate: "",
            capacity: "",
            notes: "",
        });
    };

    const openEdit = (x) => {
        setEditing(x.id);
        reset({
            formationId: x.formationId,
            salleId: x.salleId,
            startDate: toLocalInput(x.startDate),
            endDate: toLocalInput(x.endDate),
            capacity: x.capacity != null ? String(x.capacity) : "",
            notes: x.notes || "",
        });
    };

    const onSubmit = (values) => {
        const body = toApiBody(values);
        if (editing === "new") {
            createMut.mutate(body);
        } else if (editing) {
            updateMut.mutate({ id: editing, body });
        }
    };

    if (isLoading) {
        return <p className="text-slate-600">Chargement…</p>;
    }
    if (isError) {
        return (
            <p className="text-red-600">Impossible de charger les séances.</p>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">
                        Séances
                    </h1>
                    <p className="text-slate-600 text-sm mt-1">
                        Créneaux liés aux formations et aux salles. Règles
                        métier : du lundi au vendredi, entre 9h et 17h,
                        appliquées à la création / modification côté serveur.
                    </p>
                </div>
                {admin ? (
                    <button
                        type="button"
                        onClick={openCreate}
                        className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
                    >
                        Nouvelle
                    </button>
                ) : null}
            </div>

            <div className="mb-6 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                        Recherche (titre de formation)
                    </label>
                    <input
                        type="search"
                        value={listQ}
                        onChange={(e) => setListQ(e.target.value)}
                        placeholder="Ex. Numérique…"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                </div>
                <div className="w-full md:w-64">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                        Formation
                    </label>
                    <select
                        value={formationFilter}
                        onChange={(e) => setFormationFilter(e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                        <option value="">Toutes</option>
                        {activeFormations.map((f) => (
                            <option key={f.id} value={f.id}>
                                {f.title}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="w-full md:w-56">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                        Tri
                    </label>
                    <select
                        value={sortField}
                        onChange={(e) => setSortField(e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                        <option value="startDate">
                            Date de début (plus proche)
                        </option>
                        <option value="startDate_desc">
                            Date de début (plus lointaine)
                        </option>
                        <option value="formationTitle">
                            Formation (A → Z)
                        </option>
                        <option value="formationTitle_desc">
                            Formation (Z → A)
                        </option>
                    </select>
                </div>
                {admin ? (
                    <div className="w-full md:w-auto flex items-center">
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <input
                                type="checkbox"
                                className="rounded border-slate-300"
                                checked={listIncludeArchived}
                                onChange={(e) =>
                                    setListIncludeArchived(e.target.checked)
                                }
                            />
                            Inclure séances archivées
                        </label>
                    </div>
                ) : null}
            </div>

            {admin && editing ? (
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="mb-8 bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4"
                >
                    <h2 className="font-medium text-slate-900">
                        {editing === "new"
                            ? "Nouvelle séance"
                            : "Modifier la séance"}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700">
                                Formation
                            </label>
                            <select
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("formationId")}
                            >
                                <option value="">— Choisir —</option>
                                {activeFormations.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.title}
                                    </option>
                                ))}
                            </select>
                            {errors.formationId ? (
                                <p className="text-sm text-red-600 mt-1">
                                    {errors.formationId.message}
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">
                                Salle
                            </label>
                            <select
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("salleId")}
                            >
                                <option value="">— Choisir —</option>
                                {activeSalles.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({s.capacity} pl.)
                                    </option>
                                ))}
                            </select>
                            {errors.salleId ? (
                                <p className="text-sm text-red-600 mt-1">
                                    {errors.salleId.message}
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">
                                Début
                            </label>
                            <input
                                type="datetime-local"
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("startDate")}
                            />
                            {errors.startDate ? (
                                <p className="text-sm text-red-600 mt-1">
                                    {errors.startDate.message}
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">
                                Fin
                            </label>
                            <input
                                type="datetime-local"
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("endDate")}
                            />
                            {errors.endDate ? (
                                <p className="text-sm text-red-600 mt-1">
                                    {errors.endDate.message}
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">
                                Capacité (optionnel)
                            </label>
                            <input
                                type="number"
                                min={1}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("capacity")}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium text-slate-700">
                                Notes
                            </label>
                            <textarea
                                rows={2}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("notes")}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="rounded-md bg-slate-900 text-white text-sm px-4 py-2"
                            disabled={
                                createMut.isPending || updateMut.isPending
                            }
                        >
                            Enregistrer
                        </button>
                        <button
                            type="button"
                            className="rounded-md border border-slate-300 text-sm px-4 py-2"
                            onClick={() => {
                                setEditing(null);
                                reset();
                            }}
                        >
                            Annuler
                        </button>
                    </div>
                    {(createMut.isError || updateMut.isError) && (
                        <p className="text-sm text-red-600">
                            Erreur (créneau ou salle déjà pris, ou données
                            invalides).
                        </p>
                    )}
                </form>
            ) : null}

            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left">
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Début
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Fin
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Formation
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Salle
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Statut
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700 w-32">
                                Détail
                            </th>
                            {admin ? (
                                <th className="px-4 py-3 font-medium text-slate-700 w-40">
                                    Actions
                                </th>
                            ) : null}
                        </tr>
                    </thead>
                    <tbody>
                        {seances?.map((x) => {
                            const f = formations?.find(
                                (i) => i.id === x.formationId,
                            );
                            const formationLabel =
                                x.formationTitle || f?.title || x.formationId;
                            const s = salles?.find((i) => i.id === x.salleId);
                            return (
                                <tr
                                    key={x.id}
                                    className="border-b border-slate-100 hover:bg-slate-50/80"
                                >
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        {new Date(x.startDate).toLocaleString(
                                            "fr-FR",
                                        )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        {new Date(x.endDate).toLocaleString(
                                            "fr-FR",
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {formationLabel}
                                    </td>
                                    <td className="px-4 py-3">
                                        {s?.name ?? x.salleId}
                                    </td>
                                    <td className="px-4 py-3">
                                        {x.isArchived ? (
                                            <span className="text-amber-700">
                                                Archivée
                                            </span>
                                        ) : (
                                            <span className="text-emerald-700">
                                                Active
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {!x.isArchived ? (
                                            <Link
                                                to={`/seances/${x.id}`}
                                                className="text-slate-700 hover:underline"
                                            >
                                                Inscrits &amp; présences
                                            </Link>
                                        ) : (
                                            <span className="text-slate-400">
                                                —
                                            </span>
                                        )}
                                    </td>
                                    {admin ? (
                                        <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                                            <button
                                                type="button"
                                                className="text-slate-700 hover:underline"
                                                onClick={() => openEdit(x)}
                                            >
                                                Modifier
                                            </button>
                                            {!x.isArchived ? (
                                                <button
                                                    type="button"
                                                    className="text-red-700 hover:underline"
                                                    onClick={() => {
                                                        if (
                                                            confirm(
                                                                "Archiver cette séance ?",
                                                            )
                                                        ) {
                                                            archiveMut.mutate(
                                                                x.id,
                                                            );
                                                        }
                                                    }}
                                                >
                                                    Archiver
                                                </button>
                                            ) : null}
                                        </td>
                                    ) : null}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {!seances?.length ? (
                    <p className="p-6 text-slate-500">Aucune séance.</p>
                ) : null}
            </div>
        </div>
    );
}
