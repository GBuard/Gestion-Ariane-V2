import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin } from "../utils/roles.js";
import { sallesApi } from "../api/sallesApi.js";

const formSchema = z.object({
    name: z.string().min(1, "Requis"),
    capacity: z.coerce.number().int().min(1, "≥ 1"),
    location: z.string(),
    agence: z.enum(["jean_moulin", "strasbourg"]),
});

export default function Salles() {
    const { user } = useAuth();
    const admin = isAdmin(user);
    const qc = useQueryClient();
    const [editing, setEditing] = useState(null);
    const [listIncludeArchived, setListIncludeArchived] = useState(false);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["salles", { arch: admin && listIncludeArchived }],
        queryFn: async () => {
            const { data: d } = await sallesApi.list(
                admin && listIncludeArchived ? { includeArchived: true } : {},
            );
            return d.salles;
        },
    });

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            capacity: 10,
            location: "",
            agence: "jean_moulin",
        },
    });

    const createMut = useMutation({
        mutationFn: (body) => sallesApi.create(body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["salles"] });
            setEditing(null);
            reset();
        },
    });

    const updateMut = useMutation({
        mutationFn: ({ id, body }) => sallesApi.update(id, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["salles"] });
            setEditing(null);
            reset();
        },
    });

    const archiveMut = useMutation({
        mutationFn: (id) => sallesApi.archive(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["salles"] }),
    });

    const openCreate = () => {
        setEditing("new");
        reset({
            name: "",
            capacity: 10,
            location: "",
            agence: "jean_moulin",
        });
    };

    const openEdit = (s) => {
        setEditing(s.id);
        reset({
            name: s.name,
            capacity: s.capacity,
            location: s.location || "",
            agence: s.agence || "jean_moulin",
        });
    };

    const onSubmit = (values) => {
        const body = {
            name: values.name,
            capacity: Number(values.capacity),
            location: values.location || "",
            agence: values.agence,
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
        return <p className="text-red-600">Impossible de charger les salles.</p>;
    }

    return (
        <div>
            <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">
                        Salles
                    </h1>
                    <p className="text-slate-600 text-sm mt-1">
                        Espaces, site (calendrier) et capacités.
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

            {admin ? (
                <label className="mb-6 flex items-center gap-2 text-sm text-slate-700 cursor-pointer w-fit">
                    <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={listIncludeArchived}
                        onChange={(e) =>
                            setListIncludeArchived(e.target.checked)
                        }
                    />
                    Afficher les salles archivées
                </label>
            ) : null}

            {admin && editing ? (
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="mb-8 bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4"
                >
                    <h2 className="font-medium text-slate-900">
                        {editing === "new" ? "Nouvelle salle" : "Modifier la salle"}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700">
                                Nom
                            </label>
                            <input
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("name")}
                            />
                            {errors.name ? (
                                <p className="text-sm text-red-600 mt-1">
                                    {errors.name.message}
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">
                                Capacité
                            </label>
                            <input
                                type="number"
                                min={1}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("capacity")}
                            />
                            {errors.capacity ? (
                                <p className="text-sm text-red-600 mt-1">
                                    {errors.capacity.message}
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">
                                Localisation
                            </label>
                            <input
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("location")}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">
                                Site
                            </label>
                            <select
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("agence")}
                            >
                                <option value="jean_moulin">Jean-Moulin</option>
                                <option value="strasbourg">Strasbourg</option>
                            </select>
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
                </form>
            ) : null}

            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left">
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Nom
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Capacité
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Lieu
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Site
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
                        {data?.map((s) => (
                            <tr
                                key={s.id}
                                className="border-b border-slate-100 hover:bg-slate-50/80"
                            >
                                <td className="px-4 py-3 font-medium text-slate-900">
                                    {s.name}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {s.capacity}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {s.location || "—"}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {s.agence === "strasbourg"
                                        ? "Strasbourg"
                                        : "Jean-Moulin"}
                                </td>
                                <td className="px-4 py-3">
                                    {s.isArchived ? (
                                        <span className="text-amber-700">
                                            Archivée
                                        </span>
                                    ) : (
                                        <span className="text-emerald-700">
                                            Active
                                        </span>
                                    )}
                                </td>
                                {admin ? (
                                    <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                                        <button
                                            type="button"
                                            className="text-slate-700 hover:underline"
                                            onClick={() => openEdit(s)}
                                        >
                                            Modifier
                                        </button>
                                        {!s.isArchived ? (
                                            <button
                                                type="button"
                                                className="text-red-700 hover:underline"
                                                onClick={() => {
                                                    if (
                                                        confirm(
                                                            "Archiver cette salle ?",
                                                        )
                                                    ) {
                                                        archiveMut.mutate(s.id);
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
                    <p className="p-6 text-slate-500">Aucune salle.</p>
                ) : null}
            </div>
        </div>
    );
}
