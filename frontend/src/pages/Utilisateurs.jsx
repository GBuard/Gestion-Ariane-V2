import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../context/AuthContext.jsx";
import { usersApi } from "../api/usersApi.js";

const ROLES = [
    { value: "admin", label: "Administrateur" },
    { value: "referent", label: "Référent" },
    { value: "formateur", label: "Formateur" },
];

const createSchema = z.object({
    firstName: z.string().min(1, "Requis"),
    lastName: z.string().min(1, "Requis"),
    email: z.string().email("Email invalide"),
    password: z.string().min(8, "Au moins 8 caractères"),
    role: z.enum(["admin", "referent", "formateur"]),
});

const editSchema = z.object({
    firstName: z.string().min(1, "Requis"),
    lastName: z.string().min(1, "Requis"),
    email: z.string().email("Email invalide"),
    password: z.union([
        z.literal(""),
        z.string().min(8, "Au moins 8 caractères si renseigné"),
    ]),
    role: z.enum(["admin", "referent", "formateur"]),
    isActive: z.boolean(),
});

function UtilisateurForm({ variant, defaultValues, onCancel, onDone }) {
    const qc = useQueryClient();
    const schema = variant === "create" ? createSchema : editSchema;

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(schema),
        defaultValues,
    });

    const createMut = useMutation({
        mutationFn: (body) => usersApi.create(body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["users"] });
            onDone();
        },
    });

    const updateMut = useMutation({
        mutationFn: ({ id, body }) => usersApi.update(id, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["users"] });
            onDone();
        },
    });

    const onSubmit = (values) => {
        if (variant === "create") {
            createMut.mutate({
                firstName: values.firstName,
                lastName: values.lastName,
                email: values.email,
                password: values.password,
                role: values.role,
            });
        } else {
            const body = {
                firstName: values.firstName,
                lastName: values.lastName,
                email: values.email,
                role: values.role,
                isActive: values.isActive,
            };
            if (values.password && values.password.length > 0) {
                body.password = values.password;
            }
            updateMut.mutate({ id: defaultValues.userId, body });
        }
    };

    const apiErr = (err) =>
        err?.response?.data?.message || err?.message || "Erreur.";

    return (
        <form
            onSubmit={handleSubmit(onSubmit)}
            className="mb-8 bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4"
        >
            <h2 className="font-medium text-slate-900">
                {variant === "create"
                    ? "Créer un utilisateur"
                    : "Modifier l’utilisateur"}
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
                <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-700">
                        Email (identifiant de connexion)
                    </label>
                    <input
                        type="email"
                        autoComplete="off"
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        {...register("email")}
                    />
                    {errors.email ? (
                        <p className="text-sm text-red-600 mt-1">
                            {errors.email.message}
                        </p>
                    ) : null}
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-700">
                        {variant === "create"
                            ? "Mot de passe"
                            : "Nouveau mot de passe (optionnel)"}
                    </label>
                    <input
                        type="password"
                        autoComplete="new-password"
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        {...register("password")}
                    />
                    {errors.password ? (
                        <p className="text-sm text-red-600 mt-1">
                            {errors.password.message}
                        </p>
                    ) : null}
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-700">
                        Rôle
                    </label>
                    <select
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        {...register("role")}
                    >
                        {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                                {r.label}
                            </option>
                        ))}
                    </select>
                </div>
                {variant === "edit" ? (
                    <div className="md:col-span-2">
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <input
                                type="checkbox"
                                className="rounded border-slate-300"
                                {...register("isActive")}
                            />
                            Compte actif (peut se connecter)
                        </label>
                    </div>
                ) : null}
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
                        reset(defaultValues);
                        onCancel();
                    }}
                >
                    Annuler
                </button>
            </div>
            {createMut.isError ? (
                <p className="text-sm text-red-600">{apiErr(createMut.error)}</p>
            ) : null}
            {updateMut.isError ? (
                <p className="text-sm text-red-600">{apiErr(updateMut.error)}</p>
            ) : null}
        </form>
    );
}

export default function Utilisateurs() {
    const { user: currentUser } = useAuth();
    const qc = useQueryClient();
    const [editing, setEditing] = useState(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["users"],
        queryFn: async () => {
            const { data: d } = await usersApi.list();
            return d.users;
        },
    });

    const deleteMut = useMutation({
        mutationFn: (id) => usersApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    });

    const roleLabel = useMemo(() => {
        const m = new Map(ROLES.map((r) => [r.value, r.label]));
        return (role) => m.get(role) || role;
    }, []);

    const editedUser =
        editing && editing !== "new"
            ? data?.find((u) => u.id === editing)
            : null;

    const apiErr = (err) =>
        err?.response?.data?.message || err?.message || "Erreur.";

    if (isLoading) {
        return <p className="text-slate-600">Chargement…</p>;
    }
    if (isError) {
        return (
            <p className="text-red-600">
                Impossible de charger les utilisateurs.
            </p>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">
                        Utilisateurs
                    </h1>
                    <p className="text-slate-600 text-sm mt-1">
                        Comptes internes (admin, référent, formateur). Réservé
                        aux administrateurs.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setEditing("new")}
                    className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
                >
                    Nouvel utilisateur
                </button>
            </div>

            {editing === "new" ? (
                <UtilisateurForm
                    key="create"
                    variant="create"
                    defaultValues={{
                        firstName: "",
                        lastName: "",
                        email: "",
                        password: "",
                        role: "referent",
                    }}
                    onCancel={() => setEditing(null)}
                    onDone={() => setEditing(null)}
                />
            ) : null}

            {editedUser ? (
                <UtilisateurForm
                    key={editedUser.id}
                    variant="edit"
                    defaultValues={{
                        userId: editedUser.id,
                        firstName: editedUser.firstName,
                        lastName: editedUser.lastName,
                        email: editedUser.email,
                        password: "",
                        role: editedUser.role,
                        isActive: editedUser.isActive !== false,
                    }}
                    onCancel={() => setEditing(null)}
                    onDone={() => setEditing(null)}
                />
            ) : null}

            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left">
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Nom
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Email
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Rôle
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Statut
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700 w-44">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data?.map((u) => {
                            const isSelf = currentUser?.id === u.id;
                            return (
                                <tr
                                    key={u.id}
                                    className={`border-b border-slate-100 hover:bg-slate-50/80 ${
                                        isSelf ? "bg-slate-50/90" : ""
                                    }`}
                                >
                                    <td className="px-4 py-3">
                                        <span className="font-medium text-slate-900">
                                            {u.firstName} {u.lastName}
                                        </span>
                                        {isSelf ? (
                                            <span className="ml-2 text-xs text-slate-500">
                                                (vous)
                                            </span>
                                        ) : null}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {u.email}
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                        {roleLabel(u.role)}
                                    </td>
                                    <td className="px-4 py-3">
                                        {u.isActive !== false ? (
                                            <span className="text-emerald-700">
                                                Actif
                                            </span>
                                        ) : (
                                            <span className="text-amber-800">
                                                Désactivé
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                                        <button
                                            type="button"
                                            className="text-slate-700 hover:underline"
                                            onClick={() => setEditing(u.id)}
                                        >
                                            Modifier
                                        </button>
                                        <button
                                            type="button"
                                            className="text-red-700 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                                            disabled={isSelf}
                                            title={
                                                isSelf
                                                    ? "Vous ne pouvez pas supprimer votre propre compte"
                                                    : undefined
                                            }
                                            onClick={() => {
                                                if (
                                                    confirm(
                                                        `Supprimer définitivement ${u.firstName} ${u.lastName} ? Cette action est irréversible.`,
                                                    )
                                                ) {
                                                    deleteMut.mutate(u.id);
                                                }
                                            }}
                                        >
                                            Supprimer
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {!data?.length ? (
                    <p className="p-6 text-slate-500">Aucun utilisateur.</p>
                ) : null}
            </div>
            {deleteMut.isError ? (
                <p className="text-sm text-red-600 mt-3">
                    {apiErr(deleteMut.error)}
                </p>
            ) : null}
        </div>
    );
}
