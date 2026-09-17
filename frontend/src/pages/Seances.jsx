import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Archive,
    Eye,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin } from "../utils/roles.js";
import { formatSeanceSlot } from "../utils/formatSeanceSlot.js";
import { seancesApi } from "../api/seancesApi.js";
import { formationsApi } from "../api/formationsApi.js";
import { sallesApi } from "../api/sallesApi.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

function seanceStatus(x) {
    if (x.isArchived) {
        return { label: "Archivée", variant: "outline" };
    }
    if (x.trainerAbsent) {
        return { label: "Formateur absent", variant: "destructive" };
    }
    const end = new Date(x.endDate);
    if (!Number.isNaN(end.getTime()) && end.getTime() < Date.now()) {
        return { label: "Passée", variant: "secondary" };
    }
    return { label: "À venir", variant: "default" };
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
    const navigate = useNavigate();
    const qc = useQueryClient();
    const [editing, setEditing] = useState(null);
    const [listQ, setListQ] = useState("");
    const [debouncedQ, setDebouncedQ] = useState("");
    const [formationFilter, setFormationFilter] = useState("all");
    const [periodFilter, setPeriodFilter] = useState("upcoming");
    const [listIncludeArchived, setListIncludeArchived] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(listQ.trim()), 300);
        return () => clearTimeout(t);
    }, [listQ]);

    const listParams = useMemo(() => {
        const p = { sort: "startDate" };
        if (debouncedQ) p.q = debouncedQ;
        if (formationFilter && formationFilter !== "all") {
            p.formationId = formationFilter;
        }
        if (periodFilter === "past" || periodFilter === "upcoming") {
            p.period = periodFilter;
            if (periodFilter === "past") p.sort = "startDate_desc";
        }
        if (admin && listIncludeArchived) {
            p.includeArchived = true;
        }
        return p;
    }, [admin, debouncedQ, formationFilter, listIncludeArchived, periodFilter]);

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
        return <p className="text-muted-foreground">Chargement…</p>;
    }
    if (isError) {
        return (
            <p className="text-destructive">
                Impossible de charger les séances.
            </p>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Séances
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Vue synthétique des créneaux planifiés. Filtrez
                        instantanément par formation ou plage.
                    </p>
                </div>
                {admin ? (
                    <Button type="button" onClick={openCreate}>
                        <Plus data-icon="inline-start" />
                        Nouvelle séance
                    </Button>
                ) : null}
            </div>

            <Card>
                <CardHeader className="border-b pb-4">
                    <CardTitle>Filtres</CardTitle>
                    <CardDescription>
                        Recherche textuelle, formation et plage temporelle.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
                        <div className="relative min-w-[200px] flex-1">
                            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="search"
                                value={listQ}
                                onChange={(e) => setListQ(e.target.value)}
                                placeholder="Rechercher une formation…"
                                className="pl-8"
                            />
                        </div>
                        <div className="w-full lg:w-56">
                            <Label className="mb-1.5 block text-xs text-muted-foreground">
                                Formation
                            </Label>
                            <Select
                                value={formationFilter}
                                onValueChange={setFormationFilter}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Toutes" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Toutes</SelectItem>
                                    {activeFormations.map((f) => (
                                        <SelectItem key={f.id} value={f.id}>
                                            {f.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full lg:w-44">
                            <Label className="mb-1.5 block text-xs text-muted-foreground">
                                Plage
                            </Label>
                            <Select
                                value={periodFilter}
                                onValueChange={setPeriodFilter}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="upcoming">
                                        À venir
                                    </SelectItem>
                                    <SelectItem value="past">
                                        Passées
                                    </SelectItem>
                                    <SelectItem value="all">Toutes</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {admin ? (
                            <label className="flex items-center gap-2 pb-1 text-sm">
                                <Checkbox
                                    checked={listIncludeArchived}
                                    onCheckedChange={(v) =>
                                        setListIncludeArchived(v === true)
                                    }
                                />
                                Inclure les archivées
                            </label>
                        ) : null}
                    </div>
                </CardContent>
            </Card>

            {admin && editing ? (
                <Card>
                    <CardHeader className="border-b pb-4">
                        <CardTitle>
                            {editing === "new"
                                ? "Nouvelle séance"
                                : "Modifier la séance"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <form
                            onSubmit={handleSubmit(onSubmit)}
                            className="space-y-4"
                        >
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label>Formation</Label>
                                    <select
                                        className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
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
                                        <p className="text-sm text-destructive">
                                            {errors.formationId.message}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Salle</Label>
                                    <select
                                        className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
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
                                        <p className="text-sm text-destructive">
                                            {errors.salleId.message}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Début</Label>
                                    <Input
                                        type="datetime-local"
                                        {...register("startDate")}
                                    />
                                    {errors.startDate ? (
                                        <p className="text-sm text-destructive">
                                            {errors.startDate.message}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Fin</Label>
                                    <Input
                                        type="datetime-local"
                                        {...register("endDate")}
                                    />
                                    {errors.endDate ? (
                                        <p className="text-sm text-destructive">
                                            {errors.endDate.message}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Capacité (optionnel)</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        {...register("capacity")}
                                    />
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <Label>Notes</Label>
                                    <textarea
                                        rows={2}
                                        className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
                                        {...register("notes")}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="submit"
                                    disabled={
                                        createMut.isPending ||
                                        updateMut.isPending
                                    }
                                >
                                    Enregistrer
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setEditing(null);
                                        reset();
                                    }}
                                >
                                    Annuler
                                </Button>
                            </div>
                            {(createMut.isError || updateMut.isError) && (
                                <p className="text-sm text-destructive">
                                    Erreur (créneau ou salle déjà pris, ou
                                    données invalides).
                                </p>
                            )}
                        </form>
                    </CardContent>
                </Card>
            ) : null}

            <Card className="py-0">
                <CardContent className="px-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-4">
                                    Date / Heure
                                </TableHead>
                                <TableHead>Formation</TableHead>
                                <TableHead>Salle</TableHead>
                                <TableHead>Inscrits</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead className="w-12 pr-4 text-right">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {seances?.map((x) => {
                                const f = formations?.find(
                                    (i) => i.id === x.formationId,
                                );
                                const formationLabel =
                                    x.formationTitle ||
                                    f?.title ||
                                    x.formationId;
                                const s = salles?.find(
                                    (i) => i.id === x.salleId,
                                );
                                const status = seanceStatus(x);
                                const cap =
                                    x.capacity != null ? x.capacity : null;
                                const count = x.inscriptionCount ?? 0;

                                return (
                                    <TableRow key={x.id}>
                                        <TableCell className="pl-4 font-medium whitespace-normal">
                                            {formatSeanceSlot(
                                                x.startDate,
                                                x.endDate,
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-[240px] whitespace-normal">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span
                                                    className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                                                    style={{
                                                        backgroundColor:
                                                            x.formationColor ||
                                                            f?.color ||
                                                            "#3B82F6",
                                                    }}
                                                    aria-hidden
                                                />
                                                <span className="truncate">
                                                    {formationLabel}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {s?.name ?? x.salleId}
                                        </TableCell>
                                        <TableCell>
                                            {cap != null
                                                ? `${count} / ${cap}`
                                                : String(count)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={status.variant}>
                                                {status.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="pr-4 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label="Actions"
                                                    >
                                                        <MoreHorizontal />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {!x.isArchived ? (
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                navigate(
                                                                    `/seances/${x.id}`,
                                                                )
                                                            }
                                                        >
                                                            <Eye />
                                                            Voir la fiche
                                                        </DropdownMenuItem>
                                                    ) : null}
                                                    {admin ? (
                                                        <>
                                                            {!x.isArchived ? (
                                                                <DropdownMenuSeparator />
                                                            ) : null}
                                                            <DropdownMenuItem
                                                                onClick={() =>
                                                                    openEdit(x)
                                                                }
                                                            >
                                                                <Pencil />
                                                                Modifier
                                                            </DropdownMenuItem>
                                                            {!x.isArchived ? (
                                                                <DropdownMenuItem
                                                                    variant="destructive"
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
                                                                    <Archive />
                                                                    Archiver
                                                                </DropdownMenuItem>
                                                            ) : null}
                                                        </>
                                                    ) : null}
                                                    {x.isArchived && !admin ? (
                                                        <DropdownMenuItem
                                                            disabled
                                                        >
                                                            Aucune action
                                                        </DropdownMenuItem>
                                                    ) : null}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    {!seances?.length ? (
                        <p className="p-6 text-sm text-muted-foreground">
                            Aucune séance pour ces filtres.
                        </p>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}
