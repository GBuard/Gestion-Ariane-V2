import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import frLocale from "@fullcalendar/core/locales/fr.js";
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    MapPin,
    Users,
} from "lucide-react";
import { seancesApi } from "../api/seancesApi.js";
import { formatSeanceSlot } from "../utils/formatSeanceSlot.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";

const AGENCES = [
    { id: "jean_moulin", label: "Jean-Moulin" },
    { id: "strasbourg", label: "Strasbourg" },
];

function occupancyPct(count, max) {
    if (max == null || max === "" || Number(max) <= 0) return 0;
    return Math.min(100, Math.round((Number(count) / Number(max)) * 100));
}

function countLabel(count, max) {
    const c = count ?? 0;
    if (max != null && max !== "") return `${c}/${max}`;
    return `${c}`;
}

export default function Calendrier() {
    const navigate = useNavigate();
    const calendarRef = useRef(null);
    const [agence, setAgence] = useState("jean_moulin");
    const [viewTitle, setViewTitle] = useState("");
    const [currentView, setCurrentView] = useState("timeGridWeek");
    const [selected, setSelected] = useState(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["seances", "calendar", agence],
        queryFn: async () => {
            const { data: d } = await seancesApi.calendar({ agence });
            return d.events;
        },
    });

    const legend = useMemo(() => {
        const map = new Map();
        for (const e of data || []) {
            const id = e.formationId;
            if (!map.has(id)) {
                map.set(id, {
                    formationId: id,
                    title: e.formationTitle,
                    color: e.formationColor || "#3B82F6",
                });
            }
        }
        return [...map.values()].sort((a, b) =>
            a.title.localeCompare(b.title, "fr", { sensitivity: "base" }),
        );
    }, [data]);

    const events = useMemo(
        () =>
            (data || []).map((e) => {
                const absent = Boolean(e.trainerAbsent);
                const color = absent
                    ? "#9CA3AF"
                    : e.formationColor || "#3B82F6";
                return {
                    id: e.id,
                    title: e.formationTitle,
                    start: e.startDate,
                    end: e.endDate,
                    backgroundColor: color,
                    borderColor: color,
                    classNames: [
                        "fc-event-ariane",
                        absent ? "fc-event-trainer-absent" : "",
                    ].filter(Boolean),
                    extendedProps: {
                        formationTitle: e.formationTitle,
                        formationColor: e.formationColor || "#3B82F6",
                        salleName: e.salleName || "",
                        count: e.inscriptionCount ?? 0,
                        max: e.maxCapacity,
                        notes: e.notes || "",
                        trainerAbsent: absent,
                        startDate: e.startDate,
                        endDate: e.endDate,
                    },
                };
            }),
        [data],
    );

    const getApi = () => calendarRef.current?.getApi?.();

    const goPrev = () => getApi()?.prev();
    const goNext = () => getApi()?.next();
    const goToday = () => getApi()?.today();
    const changeView = (view) => {
        getApi()?.changeView(view);
        setCurrentView(view);
    };

    const openSheet = (event) => {
        const p = event.extendedProps || {};
        setSelected({
            id: event.id,
            title: p.formationTitle || event.title,
            color: p.trainerAbsent
                ? "#9CA3AF"
                : p.formationColor || "#3B82F6",
            salleName: p.salleName || "",
            count: p.count ?? 0,
            max: p.max,
            notes: p.notes || "",
            trainerAbsent: Boolean(p.trainerAbsent),
            startDate: p.startDate || event.start?.toISOString?.(),
            endDate: p.endDate || event.end?.toISOString?.(),
        });
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Calendrier des séances
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Un calendrier par site : même créneau, salles
                        différentes visibles côte à côte. Lun–ven, 9h–17h.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Période précédente"
                            onClick={goPrev}
                        >
                            <ChevronLeft />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Période suivante"
                            onClick={goNext}
                        >
                            <ChevronRight />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={goToday}
                        >
                            Aujourd’hui
                        </Button>
                    </div>
                    <Separator
                        orientation="vertical"
                        className="hidden h-6 sm:block"
                    />
                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            variant={
                                currentView === "timeGridWeek"
                                    ? "default"
                                    : "outline"
                            }
                            size="sm"
                            onClick={() => changeView("timeGridWeek")}
                        >
                            Semaine
                        </Button>
                        <Button
                            type="button"
                            variant={
                                currentView === "dayGridMonth"
                                    ? "default"
                                    : "outline"
                            }
                            size="sm"
                            onClick={() => changeView("dayGridMonth")}
                        >
                            Mois
                        </Button>
                    </div>
                </div>
            </div>

            <Tabs value={agence} onValueChange={setAgence}>
                <TabsList>
                    {AGENCES.map((a) => (
                        <TabsTrigger key={a.id} value={a.id}>
                            {a.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {legend.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Légende
                    </span>
                    {legend.map((item) => (
                        <Badge
                            key={item.formationId}
                            variant="outline"
                            className="gap-1.5 font-normal"
                        >
                            <span
                                className="size-2.5 rounded-full ring-1 ring-black/10"
                                style={{ backgroundColor: item.color }}
                                aria-hidden
                            />
                            {item.title}
                        </Badge>
                    ))}
                </div>
            ) : null}

            {isLoading ? (
                <p className="text-muted-foreground">
                    Chargement du calendrier…
                </p>
            ) : null}
            {isError ? (
                <p className="text-destructive">
                    Impossible de charger les séances.
                </p>
            ) : null}

            <Card>
                <CardHeader className="border-b py-3">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="size-4 text-muted-foreground" />
                        <CardTitle className="text-base capitalize">
                            {viewTitle || "Calendrier"}
                        </CardTitle>
                    </div>
                    <CardDescription>
                        Cliquez sur un créneau pour afficher le résumé et accéder
                        aux inscriptions.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-3 fc-root-wrapper">
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin]}
                        locales={[frLocale]}
                        locale="fr"
                        initialView="timeGridWeek"
                        firstDay={1}
                        weekends={false}
                        slotMinTime="09:00:00"
                        slotMaxTime="17:00:00"
                        allDaySlot={false}
                        height="auto"
                        contentHeight={640}
                        headerToolbar={false}
                        events={events}
                        slotEventOverlap={false}
                        datesSet={(arg) => {
                            setViewTitle(arg.view.title);
                            setCurrentView(arg.view.type);
                        }}
                        eventClick={(info) => {
                            info.jsEvent.preventDefault();
                            openSheet(info.event);
                        }}
                        eventContent={(arg) => {
                            const p = arg.event.extendedProps;
                            const pct = occupancyPct(p.count, p.max);
                            return (
                                <div
                                    className={[
                                        "fc-event-main-frame flex h-full min-h-0 flex-col gap-0.5 overflow-hidden px-1 py-0.5 text-left leading-tight",
                                        p.trainerAbsent ? "opacity-70" : "",
                                    ].join(" ")}
                                >
                                    <div className="truncate text-[11px] font-semibold">
                                        {p.formationTitle || arg.event.title}
                                    </div>
                                    {p.salleName ? (
                                        <span className="inline-flex w-fit max-w-full truncate rounded bg-black/15 px-1 py-px text-[9px] font-medium">
                                            {p.salleName}
                                        </span>
                                    ) : null}
                                    <div className="mt-auto space-y-0.5">
                                        <div className="text-[9px] opacity-95">
                                            {p.trainerAbsent
                                                ? "Formateur absent"
                                                : `${countLabel(p.count, p.max)} inscrits`}
                                        </div>
                                        {!p.trainerAbsent &&
                                        p.max != null &&
                                        p.max !== "" ? (
                                            <div className="h-1 w-full overflow-hidden rounded-full bg-black/20">
                                                <div
                                                    className="h-full rounded-full bg-white/90"
                                                    style={{
                                                        width: `${pct}%`,
                                                    }}
                                                />
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        }}
                    />
                </CardContent>
            </Card>

            <Sheet
                open={Boolean(selected)}
                onOpenChange={(open) => {
                    if (!open) setSelected(null);
                }}
            >
                <SheetContent
                    side="right"
                    className="w-full sm:max-w-md"
                >
                    {selected ? (
                        <>
                            <SheetHeader>
                                <div className="flex items-center gap-2 pr-8">
                                    <span
                                        className="size-3 shrink-0 rounded-full ring-1 ring-black/10"
                                        style={{
                                            backgroundColor: selected.color,
                                        }}
                                        aria-hidden
                                    />
                                    <SheetTitle>{selected.title}</SheetTitle>
                                </div>
                                <SheetDescription>
                                    {formatSeanceSlot(
                                        selected.startDate,
                                        selected.endDate,
                                    )}
                                </SheetDescription>
                            </SheetHeader>

                            <div className="space-y-4 px-4 pb-2">
                                {selected.trainerAbsent ? (
                                    <Badge variant="secondary">
                                        Formateur absent
                                    </Badge>
                                ) : null}

                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <MapPin className="size-3.5 shrink-0" />
                                        <span>
                                            {selected.salleName ||
                                                "Salle non renseignée"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Users className="size-3.5 shrink-0" />
                                        <span>
                                            {selected.max != null
                                                ? `${selected.count} / ${selected.max} inscrits`
                                                : `${selected.count} inscrits`}
                                        </span>
                                    </div>
                                </div>

                                {selected.max != null && selected.max > 0 ? (
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Occupation</span>
                                            <span>
                                                {occupancyPct(
                                                    selected.count,
                                                    selected.max,
                                                )}
                                                %
                                            </span>
                                        </div>
                                        <Progress
                                            value={occupancyPct(
                                                selected.count,
                                                selected.max,
                                            )}
                                        />
                                    </div>
                                ) : null}

                                {selected.notes ? (
                                    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                                            Notes
                                        </p>
                                        <p className="whitespace-pre-wrap">
                                            {selected.notes}
                                        </p>
                                    </div>
                                ) : null}
                            </div>

                            <SheetFooter>
                                <Button
                                    type="button"
                                    onClick={() =>
                                        navigate(`/seances/${selected.id}`)
                                    }
                                >
                                    Gérer les présences / Inscriptions
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setSelected(null)}
                                >
                                    Fermer
                                </Button>
                            </SheetFooter>
                        </>
                    ) : null}
                </SheetContent>
            </Sheet>
        </div>
    );
}
