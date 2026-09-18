import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Pencil, Plus, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin } from "../utils/roles.js";
import { formationsApi } from "../api/formationsApi.js";
import { usersApi } from "../api/usersApi.js";
import { sallesApi } from "../api/sallesApi.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

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

const WEEKDAY_PLURAL = {
    lundi: "lundis",
    mardi: "mardis",
    mercredi: "mercredis",
    jeudi: "jeudis",
    vendredi: "vendredis",
    samedi: "samedis",
    dimanche: "dimanches",
};

function formatTimeLabel(hhmm) {
    if (!hhmm) return "";
    const [h, m] = hhmm.trim().split(":");
    if (!h) return hhmm;
    return m === "00" ? `${Number(h)}h00` : `${Number(h)}h${m}`;
}

/** Ex. « Tous les lundis à 9h00 » */
function formatRecurrenceSummary(f) {
    const dayRaw = (f.weekdayLabel || "").trim();
    const schedule = (f.scheduleLabel || "").trim();
    if (!dayRaw || dayRaw === "—" || !schedule || schedule === "—") {
        return "Récurrence non définie";
    }
    const dayKey = dayRaw.toLowerCase();
    const plural = WEEKDAY_PLURAL[dayKey] || `${dayKey}s`;
    const startPart = schedule.split("–")[0]?.trim() || schedule;
    return `Tous les ${plural} à ${formatTimeLabel(startPart)}`;
}

function FieldError({ message }) {
    if (!message) return null;
    return <p className="text-xs text-destructive">{message}</p>;
}

function RecurrenceFields({ register, errors, activeSalles }) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
                <Label htmlFor="periodStart">Période — début</Label>
                <Input
                    id="periodStart"
                    type="date"
                    {...register("periodStart")}
                />
                <FieldError message={errors.periodStart?.message} />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="periodEnd">Période — fin</Label>
                <Input id="periodEnd" type="date" {...register("periodEnd")} />
                <FieldError message={errors.periodEnd?.message} />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="frequency">Fréquence</Label>
                <select
                    id="frequency"
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    {...register("frequency")}
                >
                    <option value="weekly">Hebdomadaire</option>
                    <option value="biweekly">Bi-hebdomadaire</option>
                    <option value="monthly">Mensuel</option>
                </select>
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="weekday">Jour</Label>
                <select
                    id="weekday"
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
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
            <div className="space-y-1.5">
                <Label htmlFor="startTime">Créneau — début</Label>
                <Input
                    id="startTime"
                    type="time"
                    {...register("startTime")}
                />
                <FieldError message={errors.startTime?.message} />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="endTime">Créneau — fin</Label>
                <Input id="endTime" type="time" {...register("endTime")} />
                <FieldError message={errors.endTime?.message} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="salleId">Salle</Label>
                <select
                    id="salleId"
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    {...register("salleId")}
                >
                    <option value="">— Choisir une salle —</option>
                    {activeSalles.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name} ({s.capacity} pl.)
                        </option>
                    ))}
                </select>
                <FieldError message={errors.salleId?.message} />
            </div>
        </div>
    );
}

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
        control,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: defaultFormValues,
    });

    const generateSeances = watch("generateSeances");
    const editRegenerate = watch("editRegenerate");
    const colorValue = watch("color");

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

    const closeDialog = () => {
        setEditing(null);
        reset(defaultFormValues);
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
        return <p className="text-muted-foreground">Chargement…</p>;
    }
    if (isError) {
        return (
            <p className="text-destructive">
                Impossible de charger les formations.
            </p>
        );
    }

    const dialogOpen = Boolean(editing);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Formations
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Ateliers et paramétrage de récurrence. La liste reste
                        lisible ; la création / édition se fait dans une fenêtre.
                    </p>
                </div>
                {admin ? (
                    <Button type="button" onClick={openCreate}>
                        <Plus data-icon="inline-start" />
                        Nouvelle formation
                    </Button>
                ) : null}
            </div>

            {createInfo ? (
                <p className="text-sm text-emerald-700">{createInfo}</p>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data?.map((f) => (
                    <Card key={f.id} className="overflow-hidden">
                        <CardHeader className="border-b pb-3">
                            <div className="flex items-start gap-3">
                                <span
                                    className="mt-1 size-3.5 shrink-0 rounded-full ring-1 ring-black/10"
                                    style={{
                                        backgroundColor: f.color || "#3B82F6",
                                    }}
                                    aria-hidden
                                />
                                <div className="min-w-0 flex-1">
                                    <CardTitle className="truncate text-base">
                                        {f.title}
                                    </CardTitle>
                                    {f.description ? (
                                        <CardDescription className="mt-1 line-clamp-2">
                                            {f.description}
                                        </CardDescription>
                                    ) : null}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2 pt-4 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Users className="size-3.5 shrink-0" />
                                <span className="truncate">
                                    {f.trainerName || "Formateur non renseigné"}
                                </span>
                            </div>
                            <p>
                                <span className="text-muted-foreground">
                                    Capacité :{" "}
                                </span>
                                <span className="font-medium">
                                    {f.capacity != null
                                        ? `${f.capacity} places`
                                        : "Non limitée"}
                                </span>
                            </p>
                            <p className="text-muted-foreground">
                                {formatRecurrenceSummary(f)}
                                {f.scheduleLabel &&
                                f.scheduleLabel !== "—" ? (
                                    <span className="block text-xs mt-0.5">
                                        Créneau : {f.scheduleLabel}
                                    </span>
                                ) : null}
                            </p>
                        </CardContent>
                        {admin ? (
                            <CardFooter className="justify-end gap-1 border-t">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Modifier"
                                    onClick={() => openEdit(f)}
                                >
                                    <Pencil />
                                </Button>
                                {!f.isArchived ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-destructive hover:text-destructive"
                                        aria-label="Archiver"
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
                                        <Archive />
                                    </Button>
                                ) : null}
                            </CardFooter>
                        ) : null}
                    </Card>
                ))}
            </div>

            {!data?.length ? (
                <p className="text-sm text-muted-foreground">
                    Aucune formation.
                </p>
            ) : null}

            <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    if (!open) closeDialog();
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editing === "new"
                                ? "Nouvelle formation"
                                : "Modifier la formation"}
                        </DialogTitle>
                        <DialogDescription>
                            Informations générales, puis récurrence pour générer
                            les séances.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="space-y-5"
                    >
                        <section className="space-y-3">
                            <h3 className="text-sm font-medium">
                                1. Informations générales
                            </h3>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5 sm:col-span-2">
                                    <Label htmlFor="title">Titre</Label>
                                    <Input id="title" {...register("title")} />
                                    <FieldError message={errors.title?.message} />
                                </div>
                                <div className="space-y-1.5 sm:col-span-2">
                                    <Label htmlFor="description">
                                        Description
                                    </Label>
                                    <Textarea
                                        id="description"
                                        rows={3}
                                        {...register("description")}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="trainerId">
                                        Intervenant
                                    </Label>
                                    <select
                                        id="trainerId"
                                        className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                                        {...register("trainerId")}
                                    >
                                        <option value="">— Choisir —</option>
                                        {trainers.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.firstName} {t.lastName} (
                                                {t.role})
                                            </option>
                                        ))}
                                    </select>
                                    <FieldError
                                        message={errors.trainerId?.message}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="capacity">
                                        Capacité max (optionnel)
                                    </Label>
                                    <Input
                                        id="capacity"
                                        type="number"
                                        min={1}
                                        {...register("capacity")}
                                    />
                                    <FieldError
                                        message={errors.capacity?.message}
                                    />
                                </div>
                                <div className="space-y-1.5 sm:col-span-2">
                                    <Label htmlFor="color">
                                        Couleur (calendrier)
                                    </Label>
                                    <div className="flex items-center gap-3">
                                        <Input
                                            id="color"
                                            type="color"
                                            className="h-9 w-14 cursor-pointer p-1"
                                            {...register("color")}
                                        />
                                        <span className="font-mono text-xs text-muted-foreground">
                                            {colorValue || "#3B82F6"}
                                        </span>
                                    </div>
                                    <FieldError message={errors.color?.message} />
                                </div>
                            </div>
                        </section>

                        <Separator />

                        <section className="space-y-3">
                            <h3 className="text-sm font-medium">
                                2. Génération automatique / Récurrence
                            </h3>

                            {editing === "new" ? (
                                <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <Controller
                                            name="generateSeances"
                                            control={control}
                                            render={({ field }) => (
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={(v) =>
                                                        field.onChange(v === true)
                                                    }
                                                />
                                            )}
                                        />
                                        Activer la génération automatique des
                                        séances
                                    </label>
                                    {generateSeances ? (
                                        <RecurrenceFields
                                            register={register}
                                            errors={errors}
                                            activeSalles={activeSalles}
                                        />
                                    ) : null}
                                </div>
                            ) : (
                                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer text-amber-950">
                                        <Controller
                                            name="editRegenerate"
                                            control={control}
                                            render={({ field }) => (
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={(v) =>
                                                        field.onChange(v === true)
                                                    }
                                                />
                                            )}
                                        />
                                        Régénérer les séances (nouvelle
                                        récurrence)
                                    </label>
                                    <p className="text-xs text-amber-900">
                                        Toutes les séances et inscriptions
                                        actuelles de cette formation seront
                                        supprimées avant la création des nouveaux
                                        créneaux.
                                    </p>
                                    {editRegenerate ? (
                                        <RecurrenceFields
                                            register={register}
                                            errors={errors}
                                            activeSalles={activeSalles}
                                        />
                                    ) : null}
                                </div>
                            )}
                        </section>

                        {createMut.isError ? (
                            <p className="text-sm text-destructive">
                                {apiErrorMessage(createMut.error)}
                            </p>
                        ) : null}
                        {updateMut.isError ? (
                            <p className="text-sm text-destructive">
                                {apiErrorMessage(updateMut.error)}
                            </p>
                        ) : null}

                        <DialogFooter className="px-0 sm:-mx-0 sm:mb-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closeDialog}
                            >
                                Annuler
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    createMut.isPending || updateMut.isPending
                                }
                            >
                                Enregistrer
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
