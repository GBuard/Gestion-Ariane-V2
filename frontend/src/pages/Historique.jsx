import { useMemo, useState } from "react";

import { Link } from "react-router-dom";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { seancesApi } from "../api/seancesApi.js";

import { formationsApi } from "../api/formationsApi.js";

import { sallesApi } from "../api/sallesApi.js";

import { beneficiairesApi } from "../api/beneficiairesApi.js";

import { isAdmin } from "../utils/roles.js";

import { useAuth } from "../context/AuthContext.jsx";

function PastSeancesBlock() {
  const { user } = useAuth();

  const admin = isAdmin(user);

  const [formationFilter, setFormationFilter] = useState("");

  const listParams = useMemo(() => {
    const p = {
      period: "past",

      sort: "startDate_desc",
    };

    if (formationFilter) {
      p.formationId = formationFilter;
    }

    if (admin) {
      p.includeArchived = true;
    }

    return p;
  }, [admin, formationFilter]);

  const {
    data: seances,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["seances", "historique", listParams],

    queryFn: async () => {
      const { data: d } = await seancesApi.list(listParams);

      return d.seances;
    },
  });

  const { data: formations } = useQuery({
    queryKey: ["formations", "historique-filter"],

    queryFn: async () => {
      const { data: d } = await formationsApi.list(
        admin ? { includeArchived: true } : {},
      );

      return d.formations;
    },
  });

  const { data: salles } = useQuery({
    queryKey: ["salles", "historique"],

    queryFn: async () => {
      const { data: d } = await sallesApi.list({});

      return d.salles;
    },
  });

  const activeFormations = useMemo(
    () => formations?.filter((f) => !f.isArchived) ?? [],

    [formations],
  );

  if (isLoading) {
    return <p className="text-slate-600">Chargement…</p>;
  }

  if (isError) {
    return (
      <p className="text-red-600">
        Impossible de charger l’historique des séances.
      </p>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-medium text-slate-900 mb-1">
        Séances passées
      </h2>

      <p className="text-slate-600 text-sm mb-4">
        Séances terminées : accès aux fiches et aux présences.
      </p>

      <div className="mb-6 max-w-md">
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Filtrer par formation
        </label>

        <select
          value={formationFilter}
          onChange={(e) => setFormationFilter(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Toutes les formations</option>

          {activeFormations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-4 py-3 font-medium text-slate-700">Fin</th>

              <th className="px-4 py-3 font-medium text-slate-700">
                Formation
              </th>

              <th className="px-4 py-3 font-medium text-slate-700">Salle</th>

              <th className="px-4 py-3 font-medium text-slate-700">Statut</th>

              <th className="px-4 py-3 font-medium text-slate-700 w-36">
                Détail
              </th>
            </tr>
          </thead>

          <tbody>
            {seances?.map((x) => {
              const s = salles?.find((i) => i.id === x.salleId);

              const label =
                x.formationTitle ||
                formations?.find((f) => f.id === x.formationId)?.title ||
                x.formationId;

              return (
                <tr
                  key={x.id}
                  className="border-b border-slate-100 hover:bg-slate-50/80"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                    {new Date(x.endDate).toLocaleString(
                      "fr-FR",

                      {
                        dateStyle: "short",

                        timeStyle: "short",
                      },
                    )}
                  </td>

                  <td className="px-4 py-3">{label}</td>

                  <td className="px-4 py-3 text-slate-600">{s?.name ?? "—"}</td>

                  <td className="px-4 py-3">
                    {x.isArchived ? (
                      <span className="text-amber-700">Archivée</span>
                    ) : (
                      <span className="text-slate-500">Terminée</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <Link
                      to={`/seances/${x.id}`}
                      className="text-slate-700 hover:underline"
                    >
                      Voir &amp; présences
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!seances?.length ? (
          <p className="p-6 text-slate-500">
            Aucune séance passée dans ce filtre.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ArchivedFormationsTab() {
  const qc = useQueryClient();

  const [sort, setSort] = useState("title");

  const [expandedId, setExpandedId] = useState(null);

  const { data: formations } = useQuery({
    queryKey: ["formations", "archives-list"],

    queryFn: async () => {
      const { data: d } = await formationsApi.list({
        includeArchived: true,
      });

      return d.formations.filter((f) => f.isArchived);
    },
  });

  const { data: allSeances } = useQuery({
    queryKey: ["seances", "archives-all"],

    queryFn: async () => {
      const { data: d } = await seancesApi.list({
        includeArchived: true,

        sort: "startDate_desc",
      });

      return d.seances;
    },
  });

  const { data: salles } = useQuery({
    queryKey: ["salles", "archives"],

    queryFn: async () => {
      const { data: d } = await sallesApi.list({ includeArchived: true });

      return d.salles;
    },
  });

  const byFormation = useMemo(() => {
    const m = new Map();

    for (const s of allSeances || []) {
      const k = String(s.formationId);

      if (!m.has(k)) m.set(k, []);

      m.get(k).push(s);
    }

    return m;
  }, [allSeances]);

  const sortedFormations = useMemo(() => {
    const list = [...(formations || [])];

    if (sort === "title_desc") {
      list.sort((a, b) =>
        b.title.localeCompare(a.title, "fr", { sensitivity: "base" }),
      );
    } else if (sort === "seances") {
      list.sort(
        (a, b) =>
          (byFormation.get(String(b.id))?.length || 0) -
          (byFormation.get(String(a.id))?.length || 0),
      );
    } else {
      list.sort((a, b) =>
        a.title.localeCompare(b.title, "fr", { sensitivity: "base" }),
      );
    }

    return list;
  }, [formations, sort, byFormation]);

  const destroyMut = useMutation({
    mutationFn: (id) => formationsApi.destroy(id),

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["formations"] });

      qc.invalidateQueries({ queryKey: ["seances"] });

      qc.invalidateQueries({ queryKey: ["seances", "calendar"] });

      qc.invalidateQueries({ queryKey: ["inscriptions"] });

      qc.invalidateQueries({ queryKey: ["formations", "archives-list"] });

      qc.invalidateQueries({ queryKey: ["seances", "archives-all"] });
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="text-sm text-slate-700 flex items-center gap-2">
          Trier par
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="title">Titre (A → Z)</option>

            <option value="title_desc">Titre (Z → A)</option>

            <option value="seances">Nombre de séances</option>
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {sortedFormations.map((f) => {
          const seances = byFormation.get(String(f.id)) || [];

          const open = expandedId === f.id;

          return (
            <div
              key={f.id}
              className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
                <button
                  type="button"
                  className="text-left font-medium text-slate-900 hover:underline flex-1 min-w-0"
                  onClick={() => setExpandedId(open ? null : f.id)}
                >
                  <span className="inline-block w-5 text-slate-400" aria-hidden>
                    {open ? "▼" : "▶"}
                  </span>

                  {f.title}

                  <span className="text-slate-500 font-normal text-sm ml-2">
                    ({seances.length} séance
                    {seances.length !== 1 ? "s" : ""})
                  </span>
                </button>

                <button
                  type="button"
                  className="text-sm text-red-700 hover:underline shrink-0"
                  onClick={() => {
                    if (
                      confirm(
                        "Supprimer définitivement cette formation archivée, toutes ses séances et inscriptions ? Cette action est irréversible.",
                      )
                    ) {
                      destroyMut.mutate(f.id);
                    }
                  }}
                >
                  Supprimer
                </button>
              </div>

              {open ? (
                <div className="px-4 py-3 text-sm">
                  {seances.length ? (
                    <ul className="divide-y divide-slate-100">
                      {seances.map((s) => {
                        const sal =
                          salles?.find((x) => x.id === s.salleId) || null;

                        return (
                          <li
                            key={s.id}
                            className="py-2 flex flex-wrap justify-between gap-2"
                          >
                            <span>
                              {new Date(s.startDate).toLocaleString(
                                "fr-FR",

                                {
                                  dateStyle: "medium",

                                  timeStyle: "short",
                                },
                              )}{" "}
                              · {sal?.name ?? "—"}
                              {s.isArchived ? (
                                <span className="text-amber-700 ml-2">
                                  (séance archivée)
                                </span>
                              ) : null}
                            </span>

                            <Link
                              to={`/seances/${s.id}`}
                              className="text-slate-700 hover:underline"
                            >
                              Fiche
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-slate-500">Aucune séance liée.</p>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}

        {!sortedFormations.length ? (
          <p className="text-slate-500">Aucune formation archivée.</p>
        ) : null}
      </div>
    </div>
  );
}

function ArchivedBeneficiairesTab() {
  const qc = useQueryClient();

  const [q, setQ] = useState("");

  const { data: rows } = useQuery({
    queryKey: ["beneficiaires", "archives", q],

    queryFn: async () => {
      const { data: d } = await beneficiairesApi.list({
        includeArchived: true,

        q: q.trim() || undefined,

        sort: "lastName",

        order: "asc",
      });

      return d.beneficiaires.filter((b) => b.isArchived);
    },
  });

  const destroyMut = useMutation({
    mutationFn: (id) => beneficiairesApi.destroy(id),

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beneficiaires"] });

      qc.invalidateQueries({ queryKey: ["beneficiaires", "archives"] });

      qc.invalidateQueries({ queryKey: ["inscriptions"] });
    },
  });

  return (
    <div>
      <div className="max-w-md mb-4">
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Recherche (nom, prénom, email)
        </label>

        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrer…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-4 py-3 font-medium text-slate-700">Nom</th>

              <th className="px-4 py-3 font-medium text-slate-700">Email</th>

              <th className="px-4 py-3 font-medium text-slate-700 w-32">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {rows?.map((b) => (
              <tr
                key={b.id}
                className="border-b border-slate-100 hover:bg-slate-50/80"
              >
                <td className="px-4 py-3">
                  {b.firstName} {b.lastName}
                </td>

                <td className="px-4 py-3 text-slate-600">{b.email || "—"}</td>

                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-red-700 hover:underline"
                    onClick={() => {
                      if (
                        confirm(
                          "Supprimer définitivement ce bénéficiaire et ses inscriptions ? Irréversible.",
                        )
                      ) {
                        destroyMut.mutate(b.id);
                      }
                    }}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!rows?.length ? (
          <p className="p-6 text-slate-500">
            Aucun bénéficiaire archivé pour cette recherche.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ArchivedSeancesTab() {
  const qc = useQueryClient();

  const [sort, setSort] = useState("startDate_desc");

  const { data: rawSeances } = useQuery({
    queryKey: ["seances", "archives-purge", sort],

    queryFn: async () => {
      const { data: d } = await seancesApi.list({
        includeArchived: true,

        sort,
      });

      return d.seances.filter((s) => s.isArchived);
    },
  });

  const { data: formations } = useQuery({
    queryKey: ["formations", "archives-seances-labels"],

    queryFn: async () => {
      const { data: d } = await formationsApi.list({ includeArchived: true });

      return d.formations;
    },
  });

  const { data: salles } = useQuery({
    queryKey: ["salles", "archives-seances"],

    queryFn: async () => {
      const { data: d } = await sallesApi.list({ includeArchived: true });

      return d.salles;
    },
  });

  const destroyMut = useMutation({
    mutationFn: (id) => seancesApi.destroy(id),

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seances"] });

      qc.invalidateQueries({ queryKey: ["seances", "calendar"] });

      qc.invalidateQueries({ queryKey: ["inscriptions"] });

      qc.invalidateQueries({ queryKey: ["seances", "archives-purge"] });

      qc.invalidateQueries({ queryKey: ["seances", "archives-all"] });

      qc.invalidateQueries({ queryKey: ["seances", "historique"] });
    },
  });

  return (
    <div>
      <p className="text-slate-600 text-sm mb-4">
        Suppression définitive : retire la séance et les inscriptions liées à
        ce créneau (les inscriptions « toute la formation » sans séance précise
        ne sont pas touchées).
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="text-sm text-slate-700 flex items-center gap-2">
          Trier par
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="startDate_desc">Date (plus récent)</option>

            <option value="startDate">Date (plus ancien)</option>

            <option value="formationTitle">Formation (A → Z)</option>

            <option value="formationTitle_desc">Formation (Z → A)</option>
          </select>
        </label>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-4 py-3 font-medium text-slate-700">Début</th>

              <th className="px-4 py-3 font-medium text-slate-700">Formation</th>

              <th className="px-4 py-3 font-medium text-slate-700">Salle</th>

              <th className="px-4 py-3 font-medium text-slate-700 w-36">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {rawSeances?.map((x) => {
              const salle = salles?.find((i) => i.id === x.salleId);

              const label =
                x.formationTitle ||
                formations?.find((f) => f.id === x.formationId)?.title ||
                x.formationId;

              return (
                <tr
                  key={x.id}
                  className="border-b border-slate-100 hover:bg-slate-50/80"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                    {new Date(x.startDate).toLocaleString("fr-FR", {
                      dateStyle: "short",

                      timeStyle: "short",
                    })}
                  </td>

                  <td className="px-4 py-3">{label}</td>

                  <td className="px-4 py-3 text-slate-600">
                    {salle?.name ?? "—"}
                  </td>

                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-red-700 hover:underline"
                      onClick={() => {
                        if (
                          confirm(
                            "Supprimer définitivement cette séance archivée et ses inscriptions sur ce créneau ? Irréversible.",
                          )
                        ) {
                          destroyMut.mutate(x.id);
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

        {!rawSeances?.length ? (
          <p className="p-6 text-slate-500">Aucune séance archivée.</p>
        ) : null}
      </div>
    </div>
  );
}

export default function Historique() {
  const { user } = useAuth();

  const admin = isAdmin(user);

  const [tab, setTab] = useState("seances");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">
        Archives &amp; historique
      </h1>

      <p className="text-slate-600 text-sm mt-1 mb-6">
        {admin
          ? "Formations, bénéficiaires et séances archivés (suppression définitive), et séances passées."
          : "Consultation des séances terminées."}
      </p>

      {admin ? (
        <div className="flex flex-wrap gap-2 mb-8 border-b border-slate-200 pb-2">
          {[
            { id: "formations", label: "Formations archivées" },

            { id: "beneficiaires", label: "Bénéficiaires archivés" },

            { id: "seancesArchive", label: "Séances archivées" },

            { id: "seances", label: "Séances passées" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                "rounded-md px-3 py-2 text-sm font-medium transition",

                tab === t.id
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "formations" && admin ? <ArchivedFormationsTab /> : null}

      {tab === "beneficiaires" && admin ? <ArchivedBeneficiairesTab /> : null}

      {tab === "seancesArchive" && admin ? <ArchivedSeancesTab /> : null}

      {tab === "seances" || !admin ? <PastSeancesBlock /> : null}
    </div>
  );
}
