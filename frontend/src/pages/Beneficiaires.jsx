import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin } from "../utils/roles.js";
import { beneficiairesApi } from "../api/beneficiairesApi.js";
import { usersApi } from "../api/usersApi.js";

const formSchema = z.object({
    firstName: z.string().min(1, "Requis"),
    lastName: z.string().min(1, "Requis"),
    email: z.union([z.literal(""), z.string().email("Email invalide")]),
    phone: z.string(),
    notes: z.string(),
    referentId: z.string().min(1, "Référent requis"),
});

export default function Beneficiaires() {
    const { user } = useAuth();
    const admin = isAdmin(user);
    const qc = useQueryClient();
    const [editing, setEditing] = useState(null);
    const [listQ, setListQ] = useState("");
    const [debouncedQ, setDebouncedQ] = useState("");
    const [referentFilter, setReferentFilter] = useState("");
    const [sortField, setSortField] = useState("lastName");
    const [sortOrder, setSortOrder] = useState("asc");
    const [listIncludeArchived, setListIncludeArchived] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(listQ.trim()), 300);
        return () => clearTimeout(t);
    }, [listQ]);

    const listParams = useMemo(() => {
        const p = {
            sort: sortField,
            order: sortOrder,
        };
        if (debouncedQ) p.q = debouncedQ;
        if (admin && referentFilter) p.referentId = referentFilter;
        if (admin && listIncludeArchived) p.includeArchived = true;
        return p;
    }, [
        admin,
        debouncedQ,
        listIncludeArchived,
        referentFilter,
        sortField,
        sortOrder,
    ]);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["beneficiaires", listParams],
        queryFn: async () => {
            const { data: d } = await beneficiairesApi.list(listParams);
            return d.beneficiaires;
        },
    });

    const { data: usersData } = useQuery({
        queryKey: ["users"],
        queryFn: async () => {
            const { data: d } = await usersApi.list();
            return d.users;
        },
        enabled: admin,
    });

    const referents = useMemo(
        () =>
            (usersData || []).filter(
                (u) => u.role === "referent" && u.isActive !== false,
            ),
        [usersData],
    );

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            notes: "",
            referentId: "",
        },
    });

    const createMut = useMutation({
        mutationFn: (body) => beneficiairesApi.create(body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["beneficiaires"] });
            setEditing(null);
            reset();
        },
    });

    const updateMut = useMutation({
        mutationFn: ({ id, body }) => beneficiairesApi.update(id, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["beneficiaires"] });
            setEditing(null);
            reset();
        },
    });

    const archiveMut = useMutation({
        mutationFn: (id) => beneficiairesApi.archive(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["beneficiaires"] }),
    });

    const referentNameById = useMemo(() => {
        const m = new Map();
        for (const r of referents) {
            m.set(r.id, `${r.firstName} ${r.lastName}`);
        }
        return m;
    }, [referents]);

    const openCreate = () => {
        setEditing("new");
        reset({
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            notes: "",
            referentId: referents[0]?.id || "",
        });
    };

    const openEdit = (b) => {
        setEditing(b.id);
        reset({
            firstName: b.firstName,
            lastName: b.lastName,
            email: b.email || "",
            phone: b.phone || "",
            notes: b.notes || "",
            referentId: b.referentId,
        });
    };

    const onSubmit = (values) => {
        const body = {
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email || undefined,
            phone: values.phone || undefined,
            notes: values.notes || undefined,
            referentId: values.referentId,
        };
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
            <p className="text-red-600">
                Impossible de charger les bénéficiaires.
            </p>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">
                        Bénéficiaires
                    </h1>
                    <p className="text-slate-600 text-sm mt-1">
                        Personnes suivies par la structure.
                    </p>
                </div>
                {admin ? (
                    <button
                        type="button"
                        onClick={openCreate}
                        className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
                    >
                        Nouveau
                    </button>
                ) : null}
            </div>

            <div className="mb-6 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                        Recherche (nom, prénom, email)
                    </label>
                    <input
                        type="search"
                        value={listQ}
                        onChange={(e) => setListQ(e.target.value)}
                        placeholder="Tapez pour filtrer…"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                </div>
                {admin ? (
                    <div className="w-full md:w-56">
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                            Référent
                        </label>
                        <select
                            value={referentFilter}
                            onChange={(e) => setReferentFilter(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        >
                            <option value="">Tous</option>
                            {referents.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.firstName} {r.lastName}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : null}
                <div className="w-full md:w-44">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                        Trier par
                    </label>
                    <select
                        value={sortField}
                        onChange={(e) => setSortField(e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                        <option value="lastName">Nom</option>
                        <option value="firstName">Prénom</option>
                        <option value="email">Email</option>
                    </select>
                </div>
                <div className="w-full md:w-36">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                        Ordre
                    </label>
                    <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                        <option value="asc">Croissant</option>
                        <option value="desc">Décroissant</option>
                    </select>
                </div>
                {admin ? (
                    <div className="w-full md:w-auto flex items-end pb-0.5">
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <input
                                type="checkbox"
                                className="rounded border-slate-300"
                                checked={listIncludeArchived}
                                onChange={(e) =>
                                    setListIncludeArchived(e.target.checked)
                                }
                            />
                            Inclure archivés
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
                            ? "Nouveau bénéficiaire"
                            : "Modifier le bénéficiaire"}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700">
                                Prénom
                            </label>
                            <input
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("firstName")}
                            />
                            {errors.firstName ? (
                                <p className="text-sm text-red-600 mt-1">
                                    {errors.firstName.message}
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">
                                Nom
                            </label>
                            <input
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("lastName")}
                            />
                            {errors.lastName ? (
                                <p className="text-sm text-red-600 mt-1">
                                    {errors.lastName.message}
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
                                {...register("email")}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">
                                Téléphone
                            </label>
                            <input
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("phone")}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium text-slate-700">
                                Référent
                            </label>
                            <select
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("referentId")}
                            >
                                <option value="">— Choisir —</option>
                                {referents.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.firstName} {r.lastName} ({r.email})
                                    </option>
                                ))}
                            </select>
                            {errors.referentId ? (
                                <p className="text-sm text-red-600 mt-1">
                                    {errors.referentId.message}
                                </p>
                            ) : null}
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium text-slate-700">
                                Notes
                            </label>
                            <textarea
                                rows={3}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("notes")}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="rounded-md bg-slate-900 text-white text-sm px-4 py-2"
                            disabled={createMut.isPending || updateMut.isPending}
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
                            Erreur à l’enregistrement. Vérifiez les données.
                        </p>
                    )}
                </form>
            ) : null}

            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left">
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Nom
                            </th>
                            {admin ? (
                                <th className="px-4 py-3 font-medium text-slate-700">
                                    Référent
                                </th>
                            ) : null}
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Email
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Tél.
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Statut
                            </th>
                            {admin ? (
                                <th className="px-4 py-3 font-medium text-slate-700 w-40">
                                    Actions
                                </th>
                            ) : null}
                        </tr>
                    </thead>
                    <tbody>
                        {data?.map((b) => (
                            <tr
                                key={b.id}
                                className="border-b border-slate-100 hover:bg-slate-50/80"
                            >
                                <td className="px-4 py-3">
                                    {b.firstName} {b.lastName}
                                </td>
                                {admin ? (
                                    <td className="px-4 py-3 text-slate-600">
                                        {referentNameById.get(b.referentId) ||
                                            "—"}
                                    </td>
                                ) : null}
                                <td className="px-4 py-3 text-slate-600">
                                    {b.email || "—"}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {b.phone || "—"}
                                </td>
                                <td className="px-4 py-3">
                                    {b.isArchived ? (
                                        <span className="text-amber-700">
                                            Archivé
                                        </span>
                                    ) : (
                                        <span className="text-emerald-700">
                                            Actif
                                        </span>
                                    )}
                                </td>
                                {admin ? (
                                    <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                                        <button
                                            type="button"
                                            className="text-slate-700 hover:underline"
                                            onClick={() => openEdit(b)}
                                        >
                                            Modifier
                                        </button>
                                        {!b.isArchived ? (
                                            <button
                                                type="button"
                                                className="text-red-700 hover:underline"
                                                onClick={() => {
                                                    if (
                                                        confirm(
                                                            "Archiver ce bénéficiaire ?",
                                                        )
                                                    ) {
                                                        archiveMut.mutate(b.id);
                                                    }
                                                }}
                                            >
                                                Archiver
                                            </button>
                                        ) : null}
                                    </td>
                                ) : null}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!data?.length ? (
                    <p className="p-6 text-slate-500">Aucun bénéficiaire.</p>
                ) : null}
            </div>
        </div>
    );
}
