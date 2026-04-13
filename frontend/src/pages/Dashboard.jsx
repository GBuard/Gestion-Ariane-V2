import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { statsApi } from "../api/statsApi.js";

const STATUS_LABELS = {
    inscrit: "Inscrit",
    present: "Présent(e)",
    absent: "Absent(e)",
    absent_excused: "Absent(e) excusé(e)",
    annule: "Annulé",
};

export default function Dashboard() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["stats", "dashboard"],
        queryFn: async () => {
            const { data: d } = await statsApi.dashboard();
            return d;
        },
    });

    if (isLoading) {
        return <p className="text-slate-600">Chargement du tableau de bord…</p>;
    }

    if (isError || !data) {
        return (
            <p className="text-red-600">
                Impossible de charger les statistiques. Vérifiez que l’API tourne
                et que vous êtes connecté.
            </p>
        );
    }

    const cards = [
        { label: "Bénéficiaires", value: data.beneficiairesTotal },
        { label: "Formations actives", value: data.formationsActives },
        { label: "Séances à venir", value: data.seancesAVenir },
        { label: "Salles", value: data.sallesTotal },
    ];

    return (
        <div>
            <h1 className="text-2xl font-semibold text-slate-900">
                Tableau de bord
            </h1>
            <p className="text-slate-600 mt-1 mb-2">
                Vue synthétique de l’activité.
            </p>
            <p className="text-sm text-slate-500 mb-6">
                <Link
                    to="/statistiques"
                    className="text-slate-700 hover:underline font-medium"
                >
                    Statistiques
                </Link>
                <span className="mx-2 text-slate-300">·</span>
                <Link
                    to="/historique"
                    className="text-slate-700 hover:underline font-medium"
                >
                    Historique des séances
                </Link>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                {cards.map((c) => (
                    <div
                        key={c.label}
                        className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm"
                    >
                        <div className="text-sm text-slate-500">{c.label}</div>
                        <div className="text-3xl font-semibold text-slate-900 mt-1">
                            {c.value}
                        </div>
                    </div>
                ))}
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-medium text-slate-900">
                        Inscriptions récentes
                    </h2>
                    <Link
                        to="/beneficiaires"
                        className="text-sm text-slate-700 hover:underline"
                    >
                        Voir les bénéficiaires
                    </Link>
                </div>
                {data.inscriptionsRecentes?.length ? (
                    <ul className="divide-y divide-slate-100 text-sm">
                        {data.inscriptionsRecentes.map((i) => (
                            <li
                                key={i.id}
                                className="py-2 flex flex-wrap gap-x-4 gap-y-1 text-slate-600"
                            >
                                <span className="font-mono text-xs text-slate-500">
                                    {new Date(i.createdAt).toLocaleString("fr-FR")}
                                </span>
                                <span>
                                    <span className="font-medium text-slate-800">
                                        {i.beneficiaireName ||
                                            `Bénéficiaire ${i.beneficiaireId}`}
                                    </span>
                                </span>
                                <span className="text-slate-500">→</span>
                                <span>
                                    <span className="font-medium text-slate-800">
                                        {i.formationTitle ||
                                            `Formation ${i.formationId}`}
                                    </span>
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                                    {STATUS_LABELS[i.status] || i.status}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-slate-500 text-sm">Aucune inscription.</p>
                )}
            </div>
        </div>
    );
}
