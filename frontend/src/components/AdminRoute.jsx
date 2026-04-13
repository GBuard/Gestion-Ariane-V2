import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin } from "../utils/roles.js";

/**
 * Restreint l’accès aux administrateurs (redirection vers le tableau de bord).
 */
export function AdminRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="text-slate-600">Chargement…</div>
        );
    }

    if (!isAdmin(user)) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}
