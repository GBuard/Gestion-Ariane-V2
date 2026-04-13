import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext.jsx";
import { statsApi } from "../api/statsApi.js";

function monthInputValue(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

export default function Statistiques() {
    const { user } = useAuth();
    const [periodMode, setPeriodMode] = useState("month");
    const [month, setMonth] = useState(monthInputValue());
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    const workshopParams = useMemo(() => {
        if (periodMode === "month") {
            return { month };
        }
        if (from && to) {
            return { from, to };
        }
        return null;
    }, [periodMode, month, from, to]);

    const { data: ws, isLoading: wsLoading, isError: wsError } = useQuery({
        queryKey: ["stats", "workshops", workshopParams],
        queryFn: async () => {
            const { data: d } = await statsApi.workshops(workshopParams);
            return d;
        },
        enabled: Boolean(workshopParams),
    });

    const { data: global, isLoading: gLoading, isError: gError } = useQuery({
        queryKey: ["stats", "global"],
        queryFn: async () => {
            const { data: d } = await statsApi.global();
            return d;
        },
    });

    const maxRef = useMemo(() => {
        const rows = ws?.referentPlacements || [];
        if (!rows.length) return 1;
        return Math.max(...rows.map((r) => r.beneficiairesPlaces), 1);
    }, [ws]);

    const maxForm = useMemo(() => {
        const rows = ws?.formationsPresence || [];
        if (!rows.length) return 1;
        const vals = rows
            .map((r) => r.avgPresencePercent)
            .filter((v) => v != null);
        if (!vals.length) return 1;
        return Math.max(...vals, 1);
    }, [ws]);

    const periodInvalid =
        periodMode === "range" && (!from || !to || from > to);

    return (
        <div>
            <h1 className="text-2xl font-semibold text-slate-900">
                Statistiques
            </h1>
            <p className="text-slate-600 text-sm mt-1 mb-6">
                Placements par référent et présence moyenne par atelier sur la
                période choisie (périmètre : {user?.role}).
            </p>

            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm mb-8">
                <h2 className="text-lg font-medium text-slate-900 mb-3">
                    Période
                </h2>
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setPeriodMode("month")}
                            className={`rounded-md px-3 py-2 text-sm font-medium ${
                                periodMode === "month"
                                    ? "bg-slate-900 text-white"
                                    : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                        >
                            Par mois
                        </button>
                        <button
                            type="button"
                            onClick={() => setPeriodMode("range")}
                            className={`rounded-md px-3 py-2 text-sm font-medium ${
                                periodMode === "range"
                                    ? "bg-slate-900 text-white"
                                    : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                        >
                            Plage personnalisée
                        </button>
                    </div>
                    {periodMode === "month" ? (
                        <label className="text-sm text-slate-700 flex items-center gap-2">
                            Mois
                            <input
                                type="month"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                            />
                        </label>
                    ) : (
                        <div className="flex flex-wrap gap-3 items-center">
                            <label className="text-sm text-slate-700 flex items-center gap-2">
                                Du
                                <input
                                    type="date"
                                    value={from}
                                    onChange={(e) => setFrom(e.target.value)}
                                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                                />
                            </label>
                            <label className="text-sm text-slate-700 flex items-center gap-2">
                                au
                                <input
                                    type="date"
                                    value={to}
                                    onChange={(e) => setTo(e.target.value)}
                                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                                />
                            </label>
                        </div>
                    )}
                </div>
                {periodInvalid ? (
                    <p className="text-amber-800 text-sm mt-2">
                        Indiquez une plage valide (du ≤ au).
                    </p>
                ) : null}
            </div>

            {wsLoading ? (
                <p className="text-slate-600 mb-8">Chargement des indicateurs…</p>
            ) : null}
            {wsError || periodInvalid ? (
                <p className="text-red-600 mb-8">
                    {periodInvalid
                        ? "Corrigez la plage de dates."
                        : "Impossible de charger les statistiques ateliers."}
                </p>
            ) : null}

            {ws && !periodInvalid ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
                    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
                        <h2 className="text-lg font-medium text-slate-900 mb-1">
                            Bénéficiaires placés par référent
                        </h2>
                        <p className="text-sm text-slate-500 mb-4">
                            Nombre distinct de bénéficiaires inscrits à au moins
                            une séance de la période (ou inscription « toute la
                            formation » sur un atelier concerné).
                        </p>
                        {ws.referentPlacements?.length ? (
                            <ul className="space-y-3">
                                {ws.referentPlacements.map((row) => (
                                    <li key={row.referentId}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-medium text-slate-800">
                                                {row.name}
                                            </span>
                                            <span className="text-slate-600 tabular-nums">
                                                {row.beneficiairesPlaces}
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-blue-600 transition-all"
                                                style={{
                                                    width: `${Math.round(
                                                        (row.beneficiairesPlaces /
                                                            maxRef) *
                                                            100,
                                                    )}%`,
                                                }}
                                            />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-slate-500 text-sm">
                                Aucune donnée sur cette période.
                            </p>
                        )}
                    </div>

                    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
                        <h2 className="text-lg font-medium text-slate-900 mb-1">
                            Présence moyenne par atelier
                        </h2>
                        <p className="text-sm text-slate-500 mb-4">
                            Moyenne des taux de présence par séance (inscrits
                            non annulés), sur les séances commençant dans la
                            période.
                        </p>
                        {ws.formationsPresence?.length ? (
                            <ul className="space-y-3">
                                {ws.formationsPresence.map((row) => (
                                    <li key={row.formationId}>
                                        <div className="flex justify-between text-sm mb-1 gap-2">
                                            <span className="font-medium text-slate-800">
                                                {row.title}
                                            </span>
                                            <span className="text-slate-600 tabular-nums shrink-0">
                                                {row.avgPresencePercent != null
                                                    ? `${row.avgPresencePercent} %`
                                                    : "—"}
                                                <span className="text-slate-400 text-xs ml-1">
                                                    ({row.seancesCount} séance
                                                    {row.seancesCount !== 1
                                                        ? "s"
                                                        : ""}
                                                    )
                                                </span>
                                            </span>
                                        </div>
                                        {row.avgPresencePercent != null ? (
                                            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-emerald-600 transition-all"
                                                    style={{
                                                        width: `${Math.round(
                                                            (row.avgPresencePercent /
                                                                maxForm) *
                                                                100,
                                                        )}%`,
                                                    }}
                                                />
                                            </div>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-slate-500 text-sm">
                                Aucune séance sur cette période.
                            </p>
                        )}
                    </div>
                </div>
            ) : null}

            <h2 className="text-lg font-medium text-slate-900 mb-3">
                Vue globale (périmètre)
            </h2>
            {gLoading ? (
                <p className="text-slate-600">Chargement…</p>
            ) : null}
            {gError || !global ? (
                <p className="text-red-600">
                    Impossible de charger les totaux globaux.
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {[
                            {
                                label: "Bénéficiaires (périmètre)",
                                value: global.beneficiaires,
                            },
                            {
                                label: "Formations (périmètre)",
                                value: global.formations,
                            },
                            {
                                label: "Séances (périmètre)",
                                value: global.seances,
                            },
                            {
                                label: "Inscriptions (périmètre)",
                                value: global.inscriptions,
                            },
                        ].map((c) => (
                            <div
                                key={c.label}
                                className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm"
                            >
                                <div className="text-sm text-slate-500">
                                    {c.label}
                                </div>
                                <div className="text-3xl font-semibold text-slate-900 mt-1">
                                    {c.value}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
                        <h3 className="font-medium text-slate-900 mb-3">
                            Inscriptions par formation (périmètre)
                        </h3>
                        {(global.repartitionParFormation || []).length ? (
                            <ul className="space-y-2 text-sm">
                                {global.repartitionParFormation.map((row) => (
                                    <li
                                        key={row.formationId}
                                        className="flex justify-between border-b border-slate-100 pb-2"
                                    >
                                        <span>{row.title}</span>
                                        <span className="tabular-nums text-slate-600">
                                            {row.inscriptionCount}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-slate-500 text-sm">
                                Aucune répartition à afficher.
                            </p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
