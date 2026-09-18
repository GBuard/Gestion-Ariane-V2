import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Mail, Pencil, Phone, Plus, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin } from "../utils/roles.js";
import { beneficiairesApi } from "../api/beneficiairesApi.js";
import { usersApi } from "../api/usersApi.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

const formSchema = z.object({
    firstName: z.string().min(1, "Requis"),
    lastName: z.string().min(1, "Requis"),
    email: z.union([z.literal(""), z.string().email("Email invalide")]),
    phone: z.string(),
    notes: z.string(),
    referentId: z.string().min(1, "Référent requis"),
});

function initials(firstName, lastName) {
    const a = (firstName || "").trim().charAt(0);
    const b = (lastName || "").trim().charAt(0);
    return `${a}${b}`.toUpperCase() || "?";
}

function FieldError({ message }) {
    if (!message) return null;
    return <p className="text-xs text-destructive">{message}</p>;
}

export default function Beneficiaires() {
    const { user } = useAuth();
    const admin = isAdmin(user);
    const canManage = admin || user?.role === "referent";
    const qc = useQueryClient();
    const [editing, setEditing] = useState(null);
    const [listQ, setListQ] = useState("");
    const [debouncedQ, setDebouncedQ] = useState("");
    const [referentFilter, setReferentFilter] = useState("all");
    const [listIncludeArchived, setListIncludeArchived] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(listQ.trim()), 300);
        return () => clearTimeout(t);
    }, [listQ]);

    const listParams = useMemo(() => {
        const p = {
            sort: "lastName",
            order: "asc",
        };
        if (debouncedQ) p.q = debouncedQ;
        if (admin && referentFilter && referentFilter !== "all") {
            p.referentId = referentFilter;
        }
        if (admin && listIncludeArchived) p.includeArchived = true;
        return p;
    }, [admin, debouncedQ, listIncludeArchived, referentFilter]);

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
            referentId: admin ? referents[0]?.id || "" : user?.id || "",
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

    const closeDialog = () => {
        setEditing(null);
        reset();
        createMut.reset();
        updateMut.reset();
    };

    const submitCreate = async (body) => {
        try {
            await createMut.mutateAsync(body);
        } catch (err) {
            const resData = err?.response?.data;
            if (
                err?.response?.status === 409 &&
                resData?.code === "POSSIBLE_DUPLICATE"
            ) {
                const names = (resData.duplicates || [])
                    .map((d) => `${d.firstName} ${d.lastName}`)
                    .join(", ");
                const ok = confirm(
                    `Doublon possible détecté : ${names}.\n\nCréer quand même un nouveau bénéficiaire ?\n(Annuler pour réutiliser un existant dans la liste.)`,
                );
                if (ok) {
                    await createMut.mutateAsync({ ...body, force: true });
                }
                return;
            }
            throw err;
        }
    };

    const onSubmit = (values) => {
        const body = {
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email || undefined,
            phone: values.phone || undefined,
            notes: values.notes || undefined,
            referentId: admin ? values.referentId : user?.id,
        };
        if (editing === "new") {
            submitCreate(body);
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
                Impossible de charger les bénéficiaires.
            </p>
        );
    }

    const dialogOpen = Boolean(editing);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Bénéficiaires
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Trouvez et gérez rapidement les personnes accompagnées.
                    </p>
                </div>
                {canManage ? (
                    <Button type="button" onClick={openCreate}>
                        <Plus data-icon="inline-start" />
                        Nouveau bénéficiaire
                    </Button>
                ) : null}
            </div>

            <Card>
                <CardHeader className="border-b pb-4">
                    <CardTitle className="text-base">Filtres</CardTitle>
                    <CardDescription>
                        Recherche multi-critères (nom, prénom, email)
                        {admin ? " et filtre par référent." : "."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
                        <div className="relative min-w-[220px] flex-1">
                            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="search"
                                value={listQ}
                                onChange={(e) => setListQ(e.target.value)}
                                placeholder="Nom, prénom ou email…"
                                className="pl-8"
                            />
                        </div>
                        {admin ? (
                            <div className="w-full lg:w-56">
                                <Label className="mb-1.5 block text-xs text-muted-foreground">
                                    Référent
                                </Label>
                                <Select
                                    value={referentFilter}
                                    onValueChange={setReferentFilter}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Tous" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tous</SelectItem>
                                        {referents.map((r) => (
                                            <SelectItem key={r.id} value={r.id}>
                                                {r.firstName} {r.lastName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : null}
                        {admin ? (
                            <label className="flex items-center gap-2 pb-1 text-sm cursor-pointer">
                                <Checkbox
                                    checked={listIncludeArchived}
                                    onCheckedChange={(v) =>
                                        setListIncludeArchived(v === true)
                                    }
                                />
                                Inclure les archivés
                            </label>
                        ) : null}
                    </div>
                </CardContent>
            </Card>

            <Card className="py-0">
                <CardContent className="px-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-4">
                                    Bénéficiaire
                                </TableHead>
                                <TableHead>Coordonnées</TableHead>
                                {admin ? (
                                    <TableHead>Référent</TableHead>
                                ) : null}
                                <TableHead>Statut</TableHead>
                                {admin ? (
                                    <TableHead className="w-24 pr-4 text-right">
                                        Actions
                                    </TableHead>
                                ) : null}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data?.map((b) => (
                                    <TableRow key={b.id}>
                                        <TableCell className="pl-4">
                                            <div className="flex items-center gap-3">
                                                <Avatar size="sm">
                                                    <AvatarFallback>
                                                        {initials(
                                                            b.firstName,
                                                            b.lastName,
                                                        )}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <div className="truncate font-medium">
                                                        {b.firstName}{" "}
                                                        {b.lastName}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="whitespace-normal">
                                            <div className="space-y-0.5 text-sm text-muted-foreground">
                                                {b.email ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Mail className="size-3.5 shrink-0" />
                                                        <span className="truncate">
                                                            {b.email}
                                                        </span>
                                                    </div>
                                                ) : null}
                                                {b.phone ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Phone className="size-3.5 shrink-0" />
                                                        <span>{b.phone}</span>
                                                    </div>
                                                ) : null}
                                                {!b.email && !b.phone ? (
                                                    <span>—</span>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        {admin ? (
                                            <TableCell>
                                                <Badge
                                                    variant="secondary"
                                                    className="font-normal"
                                                >
                                                    {referentNameById.get(
                                                        b.referentId,
                                                    ) || "—"}
                                                </Badge>
                                            </TableCell>
                                        ) : null}
                                        <TableCell>
                                            {b.isArchived ? (
                                                <Badge variant="outline">
                                                    Archivé
                                                </Badge>
                                            ) : (
                                                <Badge variant="default">
                                                    Actif
                                                </Badge>
                                            )}
                                        </TableCell>
                                        {admin ? (
                                            <TableCell className="pr-4 text-right">
                                                <div className="inline-flex items-center gap-0.5">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label="Modifier"
                                                        onClick={() =>
                                                            openEdit(b)
                                                        }
                                                    >
                                                        <Pencil />
                                                    </Button>
                                                    {!b.isArchived ? (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            className="text-destructive hover:text-destructive"
                                                            aria-label="Archiver"
                                                            onClick={() => {
                                                                if (
                                                                    confirm(
                                                                        "Archiver ce bénéficiaire ?",
                                                                    )
                                                                ) {
                                                                    archiveMut.mutate(
                                                                        b.id,
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            <Archive />
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                        ) : null}
                                    </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {!data?.length ? (
                        <p className="p-6 text-sm text-muted-foreground">
                            Aucun bénéficiaire pour ces filtres.
                        </p>
                    ) : null}
                </CardContent>
            </Card>

            <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    if (!open) closeDialog();
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editing === "new"
                                ? "Nouveau bénéficiaire"
                                : "Modifier le bénéficiaire"}
                        </DialogTitle>
                        <DialogDescription>
                            Renseignez l’identité et, si besoin, les
                            coordonnées de contact.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="space-y-4"
                    >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="benef-firstName">Prénom</Label>
                                <Input
                                    id="benef-firstName"
                                    autoComplete="given-name"
                                    {...register("firstName")}
                                />
                                <FieldError
                                    message={errors.firstName?.message}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="benef-lastName">Nom</Label>
                                <Input
                                    id="benef-lastName"
                                    autoComplete="family-name"
                                    {...register("lastName")}
                                />
                                <FieldError
                                    message={errors.lastName?.message}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="benef-email">Email</Label>
                                <Input
                                    id="benef-email"
                                    type="email"
                                    autoComplete="email"
                                    {...register("email")}
                                />
                                <FieldError message={errors.email?.message} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="benef-phone">Téléphone</Label>
                                <Input
                                    id="benef-phone"
                                    autoComplete="tel"
                                    {...register("phone")}
                                />
                            </div>
                            {admin ? (
                                <div className="space-y-1.5 sm:col-span-2">
                                    <Label htmlFor="benef-referent">
                                        Référent
                                    </Label>
                                    <select
                                        id="benef-referent"
                                        className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                                        {...register("referentId")}
                                    >
                                        <option value="">— Choisir —</option>
                                        {referents.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {r.firstName} {r.lastName}
                                            </option>
                                        ))}
                                    </select>
                                    <FieldError
                                        message={errors.referentId?.message}
                                    />
                                </div>
                            ) : (
                                <input
                                    type="hidden"
                                    {...register("referentId")}
                                />
                            )}
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="benef-notes">Notes</Label>
                                <Textarea
                                    id="benef-notes"
                                    rows={3}
                                    {...register("notes")}
                                />
                            </div>
                        </div>

                        {(createMut.isError || updateMut.isError) && (
                            <p className="text-sm text-destructive">
                                {createMut.error?.response?.data?.message ||
                                    updateMut.error?.response?.data?.message ||
                                    "Erreur à l’enregistrement. Vérifiez les données."}
                            </p>
                        )}

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
