import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import frLocale from "@fullcalendar/core/locales/fr.js";
import { seancesApi } from "../api/seancesApi.js";

const AGENCES = [
    { id: "jean_moulin", label: "Jean-Moulin" },
    { id: "strasbourg", label: "Strasbourg" },
];

export default function Calendrier() {
    const navigate = useNavigate();
    const [agence, setAgence] = useState("jean_moulin");

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
            (data || []).map((e) => ({
                id: e.id,
                title: [
                    e.formationTitle,
                    e.salleName ? `· ${e.salleName}` : null,
                ]
                    .filter(Boolean)
                    .join(" "),
                start: e.startDate,
                end: e.endDate,
                backgroundColor: e.formationColor || "#3B82F6",
                borderColor: e.formationColor || "#3B82F6",
                extendedProps: {
                    count: e.inscriptionCount,
                    max: e.maxCapacity,
                    notes: e.notes,
                },
            })),
        [data],
    );

    const countLabel = (count, max) => {
        const pl = count !== 1 ? "s" : "";
        if (max != null && max !== "") {
            return `${count}/${max} inscrit${pl}`;
        }
        return `${count} inscrit${pl}`;
    };

    return (
        <div>
            <h1 className="text-2xl font-semibold text-slate-900">
                Calendrier des séances
            </h1>
            <p className="text-slate-600 text-sm mt-1 mb-4">
                Un calendrier par site : même créneau, salles différentes
                visibles côte à côte. Lun–ven, 9h–17h.
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
                {AGENCES.map((a) => (
                    <button
                        key={a.id}
                        type="button"
                        onClick={() => setAgence(a.id)}
                        className={[
                            "rounded-md px-3 py-2 text-sm font-medium transition",
                            agence === a.id
                                ? "bg-slate-900 text-white"
                                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",
                        ].join(" ")}
                    >
                        {a.label}
                    </button>
                ))}
            </div>

            {legend.length > 0 ? (
                <div className="mb-4 flex flex-wrap gap-2 items-center">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Légende
                    </span>
                    {legend.map((item) => (
                        <button
                            key={item.formationId}
                            type="button"
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                        >
                            <span
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: item.color }}
                            />
                            {item.title}
                        </button>
                    ))}
                </div>
            ) : null}

            {isLoading ? (
                <p className="text-slate-600">Chargement du calendrier…</p>
            ) : null}
            {isError ? (
                <p className="text-red-600 mb-4">
                    Impossible de charger les séances.
                </p>
            ) : null}

            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-3 fc-root-wrapper">
                <FullCalendar
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
                    headerToolbar={{
                        left: "prev,next today",
                        center: "title",
                        right: "dayGridMonth,timeGridWeek",
                    }}
                    buttonText={{
                        today: "Aujourd’hui",
                        month: "Mois",
                        week: "Semaine",
                    }}
                    events={events}
                    eventClick={(info) => {
                        info.jsEvent.preventDefault();
                        navigate(`/seances/${info.event.id}`);
                    }}
                    eventContent={(arg) => (
                        <div className="fc-event-main-frame text-left leading-tight py-0.5">
                            <div className="font-medium text-xs truncate">
                                {arg.event.title}
                            </div>
                            <div className="text-[10px] opacity-90">
                                {countLabel(
                                    arg.event.extendedProps.count,
                                    arg.event.extendedProps.max,
                                )}
                            </div>
                            <button
                                type="button"
                                className="mt-1 text-[10px] underline font-medium"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/seances/${arg.event.id}`);
                                }}
                            >
                                Voir
                            </button>
                        </div>
                    )}
                />
            </div>
        </div>
    );
}
