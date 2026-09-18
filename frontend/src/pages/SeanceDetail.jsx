import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Check,
    ChevronsUpDown,
    FileText,
    Trash2,
    UserPlus,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin } from "../utils/roles.js";
import { formatSeanceSlot } from "../utils/formatSeanceSlot.js";
import { inscriptionsApi } from "../api/inscriptionsApi.js";
import { beneficiairesApi } from "../api/beneficiairesApi.js";
import { seancesApi } from "../api/seancesApi.js";
import { usersApi } from "../api/usersApi.js";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const STATUS_LABELS = {
    inscrit: "Inscrit",
    present: "Présent(e)",
    absent_excused: "Excusé(e)",
    absent: "Absent(e)",
    annule: "Annulé",
};

const PRESENCE_VALUES = new Set(["present", "absent_excused", "absent"]);

const benefCreateSchema = z.object({
    firstName: z
        .string({ required_error: "Requis" })
        .trim()
        .min(1, "Requis"),
    lastName: z
        .string({ required_error: "Requis" })
        .trim()
        .min(1, "Requis"),
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

function statusBadgeVariant(status) {
    if (status === "present") return "default";
    if (status === "absent_excused") return "secondary";
    if (status === "absent" || status === "annule") return "destructive";
    return "outline";
}

export default function SeanceDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const qc = useQueryClient();
    const [sheetOpen, setSheetOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
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
    const [bulkMessage, setBulkMessage] = useState(null);
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
        enabled: sheetOpen,
    });

    const { data: usersData } = useQuery({
        queryKey: ["users"],
        queryFn: async () => {
            const { data: d } = await usersApi.list();
            return d.users;
        },
        enabled: admin && sheetOpen && showCreateBenef,
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

    const selectedBenef = useMemo(
        () =>
            availableBeneficiaires.find((b) => b.id === newBenefId) ||
            (beneficiaires || []).find((b) => b.id === newBenefId) ||
            null,
        [availableBeneficiaires, beneficiaires, newBenefId],
    );

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
            setSheetOpen(false);
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
                    `Bénéficiaire créé : ${created.firstName} ${created.lastName}. Vous pouvez l’inscrire.`,
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

    const handleToggleTrainerAbsent = (checked) => {
        setAbsentFeedback(null);
        if (!data?.seance) return;

        if (!checked) {
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
        if (!status || !PRESENCE_VALUES.has(status)) return;
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

    const resetSheet = (open) => {
        setSheetOpen(open);
        if (!open) {
            setPickerOpen(false);
            setShowCreateBenef(false);
            setDuplicates([]);
            setCreateBenefError("");
            setBenefSearch("");
        }
    };

    if (isLoading) {
        return <p className="text-muted-foreground">Chargement…</p>;
    }
    if (isError || !data) {
        return (
            <p className="text-destructive">
                Séance introuvable ou accès refusé.{" "}
                <Link to="/calendrier" className="underline">
                    Retour au calendrier
                </Link>
            </p>
        );
    }

    const {
        seance,
        formationTitle,
        formationColor,
        trainerName,
        maxCapacity,
        salleName,
        inscriptions,
    } = data;

    const inscritsCount = inscriptions.length;
    const capacityPct =
        maxCapacity != null && maxCapacity > 0
            ? Math.min(100, Math.round((inscritsCount / maxCapacity) * 100))
            : 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-4 text-sm">
                <Link
                    to="/calendrier"
                    className="text-muted-foreground hover:text-foreground hover:underline"
                >
                    ← Calendrier
                </Link>
                <Link
                    to="/seances"
                    className="text-muted-foreground hover:text-foreground hover:underline"
                >
                    Liste des séances
                </Link>
            </div>

            <Card>
                <CardHeader className="border-b pb-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                                <span
                                    className="size-3 shrink-0 rounded-full ring-1 ring-black/10"
                                    style={{
                                        backgroundColor:
                                            formationColor || "#3B82F6",
                                    }}
                                    aria-hidden
                                />
                                <CardTitle className="text-xl">
                                    {formationTitle}
                                </CardTitle>
                            </div>
                            <CardDescription className="text-sm text-foreground/80">
                                {formatSeanceSlot(
                                    seance.startDate,
                                    seance.endDate,
                                )}
                                {salleName ? ` · ${salleName}` : ""}
                                {trainerName
                                    ? ` · Formateur : ${trainerName}`
                                    : ""}
                            </CardDescription>
                            {seance.notes ? (
                                <p className="text-sm text-muted-foreground">
                                    {seance.notes}
                                </p>
                            ) : null}
                            {seance.trainerAbsent ? (
                                <Badge variant="secondary">
                                    Formateur absent
                                </Badge>
                            ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => openFeuilleEmargement()}
                            >
                                <FileText data-icon="inline-start" />
                                Feuille d’émargement
                            </Button>
                            {canAddInscription ? (
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setBulkMessage(null);
                                        resetSheet(true);
                                    }}
                                >
                                    <UserPlus data-icon="inline-start" />
                                    Inscrire un bénéficiaire
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div className="min-w-[200px] flex-1 space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                    Capacité
                                </span>
                                <span className="font-medium">
                                    {inscritsCount}
                                    {maxCapacity != null
                                        ? ` / ${maxCapacity}`
                                        : " inscrits"}
                                </span>
                            </div>
                            {maxCapacity != null ? (
                                <Progress value={capacityPct} className="h-2" />
                            ) : null}
                        </div>
                        {canMarkTrainerAbsent ? (
                            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                <Checkbox
                                    checked={Boolean(seance.trainerAbsent)}
                                    disabled={absentMut.isPending}
                                    onCheckedChange={(v) =>
                                        handleToggleTrainerAbsent(v === true)
                                    }
                                />
                                Formateur absent
                            </label>
                        ) : null}
                    </div>
                    {feuilleError ? (
                        <p className="text-sm text-destructive">{feuilleError}</p>
                    ) : null}
                    {absentFeedback ? (
                        <p className="text-sm text-emerald-700">
                            {absentFeedback}
                        </p>
                    ) : null}
                    {absentMut.isError ? (
                        <p className="text-sm text-destructive">
                            {absentMut.error?.response?.data?.message ||
                                "Impossible de mettre à jour l’absence formateur."}
                        </p>
                    ) : null}
                    {bulkMessage && !sheetOpen ? (
                        <p className="text-sm text-emerald-700">{bulkMessage}</p>
                    ) : null}
                </CardContent>
            </Card>

            <Card className="py-0">
                <CardHeader className="border-b py-4">
                    <CardTitle className="text-base">
                        Émargement ({inscritsCount})
                    </CardTitle>
                    <CardDescription>
                        Pointez la présence en un clic. L’inscription se fait
                        via le tiroir latéral.
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-4">
                                    Bénéficiaire
                                </TableHead>
                                <TableHead>Référent</TableHead>
                                <TableHead>Message</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead>Présence</TableHead>
                                <TableHead className="w-12 pr-4 text-right">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {inscriptions.map((row) => {
                                const presenceValue = PRESENCE_VALUES.has(
                                    row.status,
                                )
                                    ? row.status
                                    : "";
                                return (
                                    <TableRow key={row.id}>
                                        <TableCell className="pl-4 font-medium whitespace-normal">
                                            {row.beneficiaire ? (
                                                <>
                                                    {row.beneficiaire.firstName}{" "}
                                                    {row.beneficiaire.lastName}
                                                </>
                                            ) : (
                                                row.beneficiaireId
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {row.beneficiaire?.referentName ||
                                                "—"}
                                        </TableCell>
                                        <TableCell className="max-w-[200px] whitespace-normal text-muted-foreground">
                                            {row.message ? (
                                                <span className="whitespace-pre-wrap">
                                                    {row.message}
                                                </span>
                                            ) : (
                                                "—"
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={statusBadgeVariant(
                                                    row.status,
                                                )}
                                            >
                                                {STATUS_LABELS[row.status] ||
                                                    row.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {canEditPresence(user, row) ? (
                                                <ToggleGroup
                                                    type="single"
                                                    size="sm"
                                                    spacing={0}
                                                    variant="outline"
                                                    value={presenceValue}
                                                    disabled={
                                                        updateMut.isPending
                                                    }
                                                    onValueChange={(v) => {
                                                        if (v) setPresence(row, v);
                                                    }}
                                                    className="justify-start"
                                                >
                                                    <ToggleGroupItem
                                                        value="present"
                                                        aria-label="Présent"
                                                        className="px-2.5 data-[state=on]:border-emerald-600 data-[state=on]:bg-emerald-600 data-[state=on]:text-white"
                                                    >
                                                        Présent
                                                    </ToggleGroupItem>
                                                    <ToggleGroupItem
                                                        value="absent_excused"
                                                        aria-label="Excusé"
                                                        className="px-2.5 data-[state=on]:border-amber-500 data-[state=on]:bg-amber-500 data-[state=on]:text-white"
                                                    >
                                                        Excusé
                                                    </ToggleGroupItem>
                                                    <ToggleGroupItem
                                                        value="absent"
                                                        aria-label="Absent"
                                                        className="px-2.5 data-[state=on]:border-red-600 data-[state=on]:bg-red-600 data-[state=on]:text-white"
                                                    >
                                                        Absent
                                                    </ToggleGroupItem>
                                                </ToggleGroup>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">
                                                    Lecture seule
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="pr-4 text-right">
                                            {canRemoveFromSeance(user, row) ? (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="text-destructive hover:text-destructive"
                                                    disabled={
                                                        removeMut.isPending
                                                    }
                                                    aria-label="Retirer"
                                                    onClick={() =>
                                                        handleRemoveFromSeance(
                                                            row,
                                                        )
                                                    }
                                                >
                                                    <Trash2 />
                                                </Button>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    —
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    {!inscriptions.length ? (
                        <p className="p-6 text-sm text-muted-foreground">
                            Aucun inscrit pour cette séance.
                        </p>
                    ) : null}
                </CardContent>
            </Card>

            <Sheet open={sheetOpen} onOpenChange={resetSheet}>
                <SheetContent
                    side="right"
                    className="w-full sm:max-w-md overflow-y-auto"
                >
                    <SheetHeader>
                        <SheetTitle>Inscrire un bénéficiaire</SheetTitle>
                        <SheetDescription>
                            Choisissez le bénéficiaire, un message optionnel et
                            la portée de l’inscription.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex flex-1 flex-col gap-5 px-4 pb-4">
                        {showCreateBenef ? (
                            <form
                                onSubmit={handleSubmitBenef((v) =>
                                    submitCreateBenef(v, false),
                                )}
                                className="space-y-3 rounded-lg border p-3"
                            >
                                <p className="text-sm font-medium">
                                    Créer un bénéficiaire
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label htmlFor="benef-firstName">
                                            Prénom
                                        </Label>
                                        <Input
                                            id="benef-firstName"
                                            autoComplete="given-name"
                                            {...registerBenef("firstName")}
                                        />
                                        {benefErrors.firstName ? (
                                            <p className="text-xs text-destructive">
                                                {benefErrors.firstName.message}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="benef-lastName">
                                            Nom
                                        </Label>
                                        <Input
                                            id="benef-lastName"
                                            autoComplete="family-name"
                                            {...registerBenef("lastName")}
                                        />
                                        {benefErrors.lastName ? (
                                            <p className="text-xs text-destructive">
                                                {benefErrors.lastName.message}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <Label htmlFor="benef-email">
                                            Email
                                        </Label>
                                        <Input
                                            id="benef-email"
                                            type="email"
                                            autoComplete="email"
                                            {...registerBenef("email")}
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <Label htmlFor="benef-phone">
                                            Téléphone
                                        </Label>
                                        <Input
                                            id="benef-phone"
                                            autoComplete="tel"
                                            {...registerBenef("phone")}
                                        />
                                    </div>
                                    {admin ? (
                                        <div className="col-span-2 space-y-1">
                                            <Label htmlFor="benef-referent">
                                                Référent
                                            </Label>
                                            <select
                                                id="benef-referent"
                                                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                                                {...registerBenef("referentId")}
                                            >
                                                <option value="">
                                                    — Choisir —
                                                </option>
                                                {referents.map((r) => (
                                                    <option
                                                        key={r.id}
                                                        value={r.id}
                                                    >
                                                        {r.firstName}{" "}
                                                        {r.lastName}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : null}
                                    <div className="col-span-2 space-y-1">
                                        <Label htmlFor="benef-notes">
                                            Notes
                                        </Label>
                                        <Textarea
                                            id="benef-notes"
                                            rows={2}
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
                                    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
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
                                                        {d.firstName}{" "}
                                                        {d.lastName}
                                                        {d.email
                                                            ? ` · ${d.email}`
                                                            : ""}
                                                    </span>
                                                    <Button
                                                        type="button"
                                                        variant="link"
                                                        className="h-auto px-0"
                                                        onClick={() => {
                                                            setNewBenefId(d.id);
                                                            setShowCreateBenef(
                                                                false,
                                                            );
                                                            setDuplicates([]);
                                                            setCreateBenefError(
                                                                "",
                                                            );
                                                        }}
                                                    >
                                                        Utiliser
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            disabled={createBenefMut.isPending}
                                            onClick={handleSubmitBenef((v) =>
                                                submitCreateBenef(v, true),
                                            )}
                                        >
                                            Créer quand même
                                        </Button>
                                    </div>
                                ) : null}
                                <div className="flex gap-2">
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={createBenefMut.isPending}
                                    >
                                        Enregistrer
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setShowCreateBenef(false);
                                            setDuplicates([]);
                                            setCreateBenefError("");
                                        }}
                                    >
                                        Annuler
                                    </Button>
                                </div>
                            </form>
                        ) : null}

                        <form
                            onSubmit={handleAddInscription}
                            className="flex flex-col gap-5"
                        >
                            <div className="space-y-2">
                                <Label>Bénéficiaire</Label>
                                <Popover
                                    open={pickerOpen}
                                    onOpenChange={setPickerOpen}
                                >
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={pickerOpen}
                                            className="w-full justify-between font-normal"
                                        >
                                            <span className="truncate">
                                                {selectedBenef
                                                    ? `${selectedBenef.firstName} ${selectedBenef.lastName}`
                                                    : "Rechercher…"}
                                            </span>
                                            <ChevronsUpDown className="opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="w-[var(--radix-popover-trigger-width)] p-0"
                                        align="start"
                                    >
                                        <Command shouldFilter={false}>
                                            <CommandInput
                                                placeholder="Nom, prénom ou email…"
                                                value={benefSearch}
                                                onValueChange={setBenefSearch}
                                            />
                                            <CommandList>
                                                <CommandEmpty>
                                                    Aucun bénéficiaire
                                                    disponible.
                                                </CommandEmpty>
                                                <CommandGroup>
                                                    {availableBeneficiaires.map(
                                                        (b) => (
                                                            <CommandItem
                                                                key={b.id}
                                                                value={b.id}
                                                                data-checked={
                                                                    newBenefId ===
                                                                    b.id
                                                                }
                                                                onSelect={() => {
                                                                    setNewBenefId(
                                                                        b.id,
                                                                    );
                                                                    setPickerOpen(
                                                                        false,
                                                                    );
                                                                }}
                                                            >
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="truncate">
                                                                        {
                                                                            b.firstName
                                                                        }{" "}
                                                                        {
                                                                            b.lastName
                                                                        }
                                                                    </div>
                                                                    {b.email ? (
                                                                        <div className="truncate text-xs text-muted-foreground">
                                                                            {
                                                                                b.email
                                                                            }
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                                <Check
                                                                    className={cn(
                                                                        "ml-auto",
                                                                        newBenefId ===
                                                                            b.id
                                                                            ? "opacity-100"
                                                                            : "opacity-0",
                                                                    )}
                                                                />
                                                            </CommandItem>
                                                        ),
                                                    )}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                {!showCreateBenef ? (
                                    <Button
                                        type="button"
                                        variant="link"
                                        className="h-auto px-0"
                                        onClick={openCreateBenef}
                                    >
                                        + Nouveau bénéficiaire
                                    </Button>
                                ) : null}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="inscription-message">
                                    Message (optionnel)
                                </Label>
                                <Textarea
                                    id="inscription-message"
                                    value={inscriptionMessage}
                                    onChange={(e) =>
                                        setInscriptionMessage(e.target.value)
                                    }
                                    rows={3}
                                    maxLength={1000}
                                    placeholder="Info utile pour le formateur…"
                                />
                            </div>

                            <Separator />

                            <div className="space-y-3">
                                <Label>Portée de l’inscription</Label>
                                <RadioGroup
                                    value={affectMode}
                                    onValueChange={setAffectMode}
                                    className="gap-3"
                                >
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <RadioGroupItem value="single" />
                                        Cette séance uniquement
                                    </label>
                                    <label className="flex flex-wrap items-center gap-2 text-sm cursor-pointer">
                                        <RadioGroupItem value="next" />
                                        <span>Les</span>
                                        <Input
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
                                            className="h-7 w-16"
                                        />
                                        <span>prochaine(s) séance(s)</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <RadioGroupItem value="all" />
                                        Toutes les séances de la formation
                                    </label>
                                </RadioGroup>
                            </div>

                            {bulkMessage ? (
                                <p className="text-sm text-emerald-700">
                                    {bulkMessage}
                                </p>
                            ) : null}
                            {bulkMut.isError ? (
                                <p className="text-sm text-destructive">
                                    {bulkMut.error?.response?.data?.message ||
                                        "Impossible d’inscrire (déjà inscrit ou erreur)."}
                                </p>
                            ) : null}

                            <SheetFooter className="px-0">
                                <Button
                                    type="submit"
                                    disabled={
                                        !newBenefId || bulkMut.isPending
                                    }
                                >
                                    {affectMode === "all"
                                        ? "Inscrire (toutes)"
                                        : affectMode === "next"
                                          ? `Inscrire (${nextSeancesCount} prochaines)`
                                          : "Inscrire à cette séance"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => resetSheet(false)}
                                >
                                    Fermer
                                </Button>
                            </SheetFooter>
                        </form>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
