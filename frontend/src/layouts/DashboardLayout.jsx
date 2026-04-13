import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin } from "../utils/roles.js";

const navCls = ({ isActive }) =>
    [
        "block rounded-md px-3 py-2 text-sm font-medium transition",
        isActive
            ? "bg-slate-800 text-white"
            : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
    ].join(" ");

export function DashboardLayout() {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen flex bg-slate-100">
            <aside className="w-56 shrink-0 bg-slate-900 text-white flex flex-col">
                <div className="p-4 border-b border-slate-800">
                    <div className="text-lg font-semibold tracking-tight">
                        Gestion Ariane
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                        Ariane Méditerranée
                    </div>
                </div>
                <nav className="p-3 flex flex-col gap-0.5 flex-1">
                    <NavLink to="/dashboard" className={navCls}>
                        Tableau de bord
                    </NavLink>
                    <NavLink to="/beneficiaires" className={navCls}>
                        Bénéficiaires
                    </NavLink>
                    <NavLink to="/formations" className={navCls}>
                        Formations
                    </NavLink>
                    <NavLink to="/salles" className={navCls}>
                        Salles
                    </NavLink>
                    <NavLink to="/seances" className={navCls}>
                        Séances
                    </NavLink>
                    <NavLink to="/calendrier" className={navCls}>
                        Calendrier
                    </NavLink>
                    <NavLink to="/historique" className={navCls}>
                        Archives
                    </NavLink>
                    <NavLink to="/statistiques" className={navCls}>
                        Statistiques
                    </NavLink>
                    {isAdmin(user) ? (
                        <NavLink to="/utilisateurs" className={navCls}>
                            Utilisateurs
                        </NavLink>
                    ) : null}
                </nav>
                <div className="p-3 border-t border-slate-800">
                    <button
                        type="button"
                        onClick={logout}
                        className="w-full text-left text-sm text-slate-300 hover:text-white px-3 py-2 rounded-md hover:bg-slate-800/60"
                    >
                        Déconnexion
                    </button>
                </div>
            </aside>
            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-14 shrink-0 border-b border-slate-200 bg-white flex items-center px-6">
                    <div className="text-sm text-slate-600">
                        <span className="font-medium text-slate-900">
                            {user?.firstName} {user?.lastName}
                        </span>
                        <span className="mx-2 text-slate-300">·</span>
                        <span>{user?.email}</span>
                        <span className="mx-2 text-slate-300">·</span>
                        <span className="capitalize">{user?.role}</span>
                    </div>
                </header>
                <main className="flex-1 p-6 overflow-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
