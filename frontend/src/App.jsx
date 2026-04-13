import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { AdminRoute } from "./components/AdminRoute.jsx";
import { DashboardLayout } from "./layouts/DashboardLayout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Beneficiaires from "./pages/Beneficiaires.jsx";
import Formations from "./pages/Formations.jsx";
import Salles from "./pages/Salles.jsx";
import Seances from "./pages/Seances.jsx";
import Calendrier from "./pages/Calendrier.jsx";
import SeanceDetail from "./pages/SeanceDetail.jsx";
import Utilisateurs from "./pages/Utilisateurs.jsx";
import Statistiques from "./pages/Statistiques.jsx";
import Historique from "./pages/Historique.jsx";

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route
                element={
                    <ProtectedRoute>
                        <DashboardLayout />
                    </ProtectedRoute>
                }
            >
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/beneficiaires" element={<Beneficiaires />} />
                <Route path="/formations" element={<Formations />} />
                <Route path="/salles" element={<Salles />} />
                <Route path="/seances" element={<Seances />} />
                <Route path="/seances/:id" element={<SeanceDetail />} />
                <Route path="/calendrier" element={<Calendrier />} />
                <Route path="/statistiques" element={<Statistiques />} />
                <Route path="/historique" element={<Historique />} />
                <Route
                    path="/utilisateurs"
                    element={
                        <AdminRoute>
                            <Utilisateurs />
                        </AdminRoute>
                    }
                />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}
