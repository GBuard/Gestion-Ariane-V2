import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin } from "../utils/roles.js";
import { formationsApi } from "../api/formationsApi.js";
import { usersApi } from "../api/usersApi.js";
import { sallesApi } from "../api/sallesApi.js";

const formSchema = z
    .object({
        title: z.string().min(1, "Requis"),
        description: z.string(),
        trainerId: z.string().min(1, "Intervenant requis"),
        capacity: z.string(),
        color: z.string(),
        generateSeances: z.boolean(),
        editRegenerate: z.boolean(),
        periodStart: z.string(),
        periodEnd: z.string(),
        frequency: z.enum(["weekly", "biweekly", "monthly"]),
        weekday: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        salleId: z.string(),
    })
    .superRefine((data, ctx) => {
        if (data.capacity !== "" && data.capacity !== undefined) {
            const n = Number(data.capacity);
            if (!Number.isInteger(n) || n < 1) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["capacity"],
                    message: "Entier ≥ 1 ou laisser vide",
                });
            }
        }
        if (data.color && data.color.trim()) {
            const c = data.color.trim();
            if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(c)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["color"],
                    message: "Format #RGB ou #RRGGBB",
                });
            }
        }
        const needRec = data.generateSeances || data.editRegenerate;
        if (needRec) {
            if (!data.periodStart?.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["periodStart"],
                    message: "Date de début requise",
                });
            }
            if (!data.periodEnd?.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["periodEnd"],
                    message: "Date de fin requise",
                });
            }
            if (!data.startTime?.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["startTime"],
                    message: "Heure de début requise",
                });
            }
            if (!data.endTime?.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["endTime"],
                    message: "Heure de fin requise",
                });
            }
            if (!data.salleId?.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["salleId"],
                    message: "Salle requise",
                });
            }
        }
    });

const defaultFormValues = {
    title: "",
    description: "",
    trainerId: "",
    capacity: "",
    color: "#3B82F6",
    generateSeances: true,
    editRegenerate: false,
    periodStart: "",
    periodEnd: "",
    frequency: "weekly",
    weekday: "1",
    startTime: "09:00",
    endTime: "12:00",
    salleId: "",
};

export default function Formations() {
    const { user } = useAuth();
    const admin = isAdmin(user);
    const qc = useQueryClient();
    const [editing, setEditing] = useState(null);
    const [createInfo, setCreateInfo] = useState(null);
    const { data, isLoading, isError } = useQuery({
        queryKey: ["formations", "actives"],
        queryFn: async () => {
            const { data: d } = await formationsApi.list({});
            return d.formations;
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

    const { data: sallesData } = useQuery({
        queryKey: ["salles"],
        queryFn: async () => {
            const { data: d } = await sallesApi.list();
            return d.salles;
        },
        enabled: admin,
    });

    const trainers = useMemo(
        () =>
            (usersData || []).filter(
                (u) =>
                    ["admin", "referent", "formateur"].includes(u.role) &&
                    u.isActive !== false,
            ),
        [usersData],
    );

    const activeSalles = useMemo(
        () => (sallesData || []).filter((s) => !s.isArchived),
        [sallesData],
    );

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: defaultFormValues,
    });

    const generateSeances = watch("generateSeances");
    const editRegenerate = watch("editRegenerate");

    const createMut = useMutation({
        mutationFn: (body) => formationsApi.create(body),
        onSuccess: (axiosRes) => {
            qc.invalidateQueries({ queryKey: ["formations"] });
            qc.invalidateQueries({ queryKey: ["seances"] });
            qc.invalidateQueries({ queryKey: ["seances", "calendar"] });
            setEditing(null);
            reset(defaultFormValues);
            const n = axiosRes?.data?.seancesCreated;
            setCreateInfo(
                typeof n === "number" && n > 0
                    ? `${n} séance(s) créée(s).`
                    : null,
            );
        },
    });

    const updateMut = useMutation({
        mutationFn: ({ id, body }) => formationsApi.update(id, body),
        onSuccess: (axiosRes) => {
            qc.invalidateQueries({ queryKey: ["formations"] });
            qc.invalidateQueries({ queryKey: ["seances"] });
            qc.invalidateQueries({ queryKey: ["seances", "calendar"] });
            qc.invalidateQueries({ queryKey: ["inscriptions"] });
            setEditing(null);
            reset(defaultFormValues);
            const n = axiosRes?.data?.seancesCreated;
            if (typeof n === "number") {
                setCreateInfo(
                    n > 0
                        ? `${n} séance(s) régénérée(s). Les inscriptions précédentes ont été supprimées.`
                        : "Régénération : aucune séance créée (vérifiez la période ou le jour).",
                );
            }
        },
    });

    const archiveMut = useMutation({
        mutationFn: (id) => formationsApi.archive(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["formations"] }),
    });

    const toCreateBody = (values) => {
        const cap =
            values.capacity === "" || values.capacity === undefined
                ? null
                : Number(values.capacity);
        const body = {
            title: values.title,
            description: values.description || "",
            trainerId: values.trainerId,
            capacity: cap,
            color: values.color?.trim() || "#3B82F6",
        };
        if (values.generateSeances) {
            body.recurrence = {
                periodStart: values.periodStart,
                periodEnd: values.periodEnd,
                frequency: values.frequency,
                weekday: Number(values.weekday),
                startTime: values.startTime,
                endTime: values.endTime,
                salleId: values.salleId,
            };
        }
        return body;
    };

    const toUpdateBody = (values) => {
        const body = {
            title: values.title,
            description: values.description || "",
            trainerId: values.trainerId,
            capacity:
                values.capacity === "" || values.capacity === undefined
                    ? null
                    : Number(values.capacity),
            color: values.color?.trim() || "#3B82F6",
        };
        if (values.editRegenerate) {
            body.recurrence = {
                periodStart: values.periodStart,
                periodEnd: values.periodEnd,
                frequency: values.frequency,
                weekday: Number(values.weekday),
                startTime: values.startTime,
                endTime: values.endTime,
                salleId: values.salleId,
            };
        }
        return body;
    };

    const openCreate = () => {
        setCreateInfo(null);
        setEditing("new");
        reset({
            ...defaultFormValues,
            trainerId: trainers[0]?.id || "",
            salleId: activeSalles[0]?.id || "",
        });
    };

    const openEdit = (f) => {
        setCreateInfo(null);
        setEditing(f.id);
        reset({
            ...defaultFormValues,
            title: f.title,
            description: f.description || "",
            trainerId: f.trainerId,
            capacity: f.capacity != null ? String(f.capacity) : "",
            color: f.color || "#3B82F6",
            generateSeances: false,
            editRegenerate: false,
            periodStart: "",
            periodEnd: "",
            frequency: "weekly",
            weekday: "1",
            startTime: "09:00",
            endTime: "12:00",
            salleId: activeSalles[0]?.id || "",
        });
    };

    const onSubmit = (values) => {
        setCreateInfo(null);
        if (editing === "new") {
            createMut.mutate(toCreateBody(values));
        } else if (editing) {
            updateMut.mutate({ id: editing, body: toUpdateBody(values) });
        }
    };

    const apiErrorMessage = (err) =>
        err?.response?.data?.message ||
        err?.message ||
        "Erreur à l’enregistrement.";

    if (isLoading) {
        return <p className="text-slate-600">Chargement…</p>;
    }
    if (isError) {
        return (
            <p className="text-red-600">
                Impossible de charger les formations.
            </p>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">
                        Formations
                    </h1>
                    <p className="text-slate-600 text-sm mt-1">
                        Ateliers et parcours proposés. La récurrence génère les
                        séances à la création ; récurrence modifiable à l’édition.
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

            {admin && editing ? (
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="mb-8 bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4"
                >
                    <h2 className="font-medium text-slate-900">
                        {editing === "new"
                            ? "Nouvelle formation"
                            : "Modifier la formation"}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium text-slate-700">
                                Titre
                            </label>
                            <input
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("title")}
                            />
                            {errors.title ? (
                                <p className="text-sm text-red-600 mt-1">
                                    {errors.title.message}
                                </p>
                            ) : null}
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium text-slate-700">
                                Description
                            </label>
                            <textarea
                                rows={3}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("description")}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">
                                Intervenant
                            </label>
                            <select
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                {...register("trainerId")}
                            >
                                <option value="">— Choisir —</option>
                                {trainers.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.firstName} {t.lastName} ({t.role})
                                    </option>
                                ))}
                            </select>
                            {errors.trainerId ? (
                                <p className="text-sm text-red-600 mt-1">
                                    {errors.trainerId.message}
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">
                                Capacité max (optionnel)
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
                                Couleur (calendrier)
                            </label>
                            <div className="mt-1 flex items-center gap-3">
                                <input
                                    type="color"
                                    className="h-9 w-12 cursor-pointer rounded border border-slate-300"
                                    {...register("color")}
                                />
                                <span className="text-xs font-mono text-slate-600">
                                    {watch("color") || "#3B82F6"}
                                </span>
                            </div>
                            {errors.color ? (
                                <p className="text-sm text-red-600 mt-1">
                                    {errors.color.message}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    {editing === "new" ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-300"
                                    {...register("generateSeances")}
                                />
                                Générer automatiquement les séances (récurrence)
                            </label>
                            {generateSeances ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">
                                            Période — début
                                        </label>
                                        <input
                                            type="date"
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            {...register("periodStart")}
                                        />
                                        {errors.periodStart ? (
                                            <p className="text-sm text-red-600 mt-1">
                                                {errors.periodStart.message}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">
                                            Période — fin
                                        </label>
                                        <input
                                            type="date"
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            {...register("periodEnd")}
                                        />
                                        {errors.periodEnd ? (
                                            <p className="text-sm text-red-600 mt-1">
                                                {errors.periodEnd.message}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">
                                            Fréquence
                                        </label>
                                        <select
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            {...register("frequency")}
                                        >
                                            <option value="weekly">
                                                Hebdomadaire
                                            </option>
                                            <option value="biweekly">
                                                Bi-hebdomadaire
                                            </option>
                                            <option value="monthly">
                                                Mensuel
                                            </option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">
                                            Jour de la semaine
                                        </label>
                                        <select
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            {...register("weekday")}
                                        >
                                            <option value="1">Lundi</option>
                                            <option value="2">Mardi</option>
                                            <option value="3">Mercredi</option>
                                            <option value="4">Jeudi</option>
                                            <option value="5">Vendredi</option>
                                            <option value="6">Samedi</option>
                                            <option value="7">Dimanche</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">
                                            Heure de début
                                        </label>
                                        <input
                                            type="time"
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            {...register("startTime")}
                                        />
                                        {errors.startTime ? (
                                            <p className="text-sm text-red-600 mt-1">
                                                {errors.startTime.message}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">
                                            Heure de fin
                                        </label>
                                        <input
                                            type="time"
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            {...register("endTime")}
                                        />
                                        {errors.endTime ? (
                                            <p className="text-sm text-red-600 mt-1">
                                                {errors.endTime.message}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-sm font-medium text-slate-700">
                                            Salle
                                        </label>
                                        <select
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            {...register("salleId")}
                                        >
                                            <option value="">
                                                — Choisir une salle —
                                            </option>
                                            {activeSalles.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} ({s.capacity}{" "}
                                                    pl.)
                                                </option>
                                            ))}
                                        </select>
                                        {errors.salleId ? (
                                            <p className="text-sm text-red-600 mt-1">
                                                {errors.salleId.message}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {editing && editing !== "new" ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-4">
                            <label className="flex items-center gap-2 text-sm font-medium text-amber-950">
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-300"
                                    {...register("editRegenerate")}
                                />
                                Régénérer les séances (nouvelle récurrence)
                            </label>
                            <p className="text-xs text-amber-900">
                                Toutes les séances et inscriptions actuelles de
                                cette formation seront supprimées avant la
                                création des nouveaux créneaux.
                            </p>
                            {editRegenerate ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">
                                            Période — début
                                        </label>
                                        <input
                                            type="date"
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            {...register("periodStart")}
                                        />
                                        {errors.periodStart ? (
                                            <p className="text-sm text-red-600 mt-1">
                                                {errors.periodStart.message}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">
                                            Période — fin
                                        </label>
                                        <input
                                            type="date"
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            {...register("periodEnd")}
                                        />
                                        {errors.periodEnd ? (
                                            <p className="text-sm text-red-600 mt-1">
                                                {errors.periodEnd.message}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">
                                            Fréquence
                                        </label>
                                        <select
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            {...register("frequency")}
                                        >
                                            <option value="weekly">
                                                Hebdomadaire
                                            </option>
                                            <option value="biweekly">
                                                Bi-hebdomadaire
                                            </option>
                                            <option value="monthly">
                                                Mensuel
                                            </option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">
                                            Jour de la semaine
                                        </label>
                                        <select
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            {...register("weekday")}
                                        >
                                            <option value="1">Lundi</option>
                                            <option value="2">Mardi</option>
                                            <option value="3">Mercredi</option>
                                            <option value="4">Jeudi</option>
                                            <option value="5">Vendredi</option>
                                            <option value="6">Samedi</option>
                                            <option value="7">Dimanche</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">
                                            Heure de début
                                        </label>
                                        <input
                                            type="time"
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            {...register("startTime")}
                                        />
                                        {errors.startTime ? (
                                            <p className="text-sm text-red-600 mt-1">
                                                {errors.startTime.message}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">
                                            Heure de fin
                                        </label>
                                        <input
                                            type="time"
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            {...register("endTime")}
                                        />
                                        {errors.endTime ? (
                                            <p className="text-sm text-red-600 mt-1">
                                                {errors.endTime.message}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-sm font-medium text-slate-700">
                                            Salle
                                        </label>
                                        <select
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            {...register("salleId")}
                                        >
                                            <option value="">
                                                — Choisir une salle —
                                            </option>
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
                                </div>
                            ) : null}
                        </div>
                    ) : null}

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
                                reset(defaultFormValues);
                                setCreateInfo(null);
                            }}
                        >
                            Annuler
                        </button>
                    </div>
                    {createInfo ? (
                        <p className="text-sm text-emerald-700">{createInfo}</p>
                    ) : null}
                    {createMut.isError ? (
                        <p className="text-sm text-red-600">
                            {apiErrorMessage(createMut.error)}
                        </p>
                    ) : null}
                    {updateMut.isError ? (
                        <p className="text-sm text-red-600">
                            {apiErrorMessage(updateMut.error)}
                        </p>
                    ) : null}
                </form>
            ) : null}

            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left">
                            <th className="px-4 py-3 font-medium text-slate-700 w-10">
                                {" "}
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Titre
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Jour (réf.)
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Créneau (réf.)
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700">
                                Formateur
                            </th>
                            {admin ? (
                                <th className="px-4 py-3 font-medium text-slate-700 w-40">
                                    Actions
                                </th>
                            ) : null}
                        </tr>
                    </thead>
                    <tbody>
                        {data?.map((f) => (
                            <tr
                                key={f.id}
                                className="border-b border-slate-100 hover:bg-slate-50/80"
                            >
                                <td className="px-4 py-3 align-middle">
                                    <span
                                        className="inline-block h-6 w-6 rounded border border-slate-200"
                                        style={{
                                            backgroundColor:
                                                f.color || "#3B82F6",
                                        }}
                                        title={f.color || ""}
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <div className="font-medium text-slate-900">
                                        {f.title}
                                    </div>
                                    {f.description ? (
                                        <div className="text-slate-500 text-xs mt-0.5 line-clamp-2">
                                            {f.description}
                                        </div>
                                    ) : null}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {f.weekdayLabel ?? "—"}
                                </td>
                                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                    {f.scheduleLabel ?? "—"}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {f.trainerName ?? "—"}
                                </td>
                                {admin ? (
                                    <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                                        <button
                                            type="button"
                                            className="text-slate-700 hover:underline"
                                            onClick={() => openEdit(f)}
                                        >
                                            Modifier
                                        </button>
                                        {!f.isArchived ? (
                                            <button
                                                type="button"
                                                className="text-amber-800 hover:underline"
                                                onClick={() => {
                                                    if (
                                                        confirm(
                                                            "Archiver cette formation ?",
                                                        )
                                                    ) {
                                                        archiveMut.mutate(f.id);
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
                    <p className="p-6 text-slate-500">Aucune formation.</p>
                ) : null}
            </div>
        </div>
    );
}
