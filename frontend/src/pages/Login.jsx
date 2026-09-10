import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../context/AuthContext.jsx";

const schema = z.object({
    email: z.string().email("Email invalide"),
    password: z.string().min(1, "Mot de passe requis"),
});

export default function Login() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const [apiError, setApiError] = useState("");

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm({ resolver: zodResolver(schema) });

    if (user) {
        return <Navigate to="/calendrier" replace />;
    }

    const onSubmit = async (values) => {
        setApiError("");
        try {
            await login(values.email, values.password);
            navigate("/calendrier", { replace: true });
        } catch (err) {
            const status = err?.response?.status;
            const serverMsg = err?.response?.data?.message;
            const code = err?.code;
            let msg =
                serverMsg ||
                (code === "ERR_NETWORK" || err?.message === "Network Error"
                    ? "Impossible de joindre l’API. Vérifiez que le front a été buildé avec VITE_API_URL=https://api… (F12 → Réseau) et que le certificat / le DNS sont corrects."
                    : null);
            if (!msg && status === 401) {
                msg = "Email ou mot de passe incorrect.";
            }
            if (!msg && status >= 500) {
                msg = "Erreur serveur. Consultez les logs PM2 sur le VPS.";
            }
            setApiError(msg || "Connexion impossible. Ouvrez la console (F12) pour plus de détails.");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                <h1 className="text-xl font-semibold text-slate-900">
                    Connexion
                </h1>
                <p className="text-sm text-slate-500 mt-1 mb-6">
                    Gestion Ariane — espace interne
                </p>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {apiError ? (
                        <div
                            className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2"
                            role="alert"
                        >
                            {apiError}
                        </div>
                    ) : null}
                    <div>
                        <label
                            htmlFor="email"
                            className="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="username"
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                            {...register("email")}
                        />
                        {errors.email ? (
                            <p className="text-sm text-red-600 mt-1">
                                {errors.email.message}
                            </p>
                        ) : null}
                    </div>
                    <div>
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Mot de passe
                        </label>
                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                            {...register("password")}
                        />
                        {errors.password ? (
                            <p className="text-sm text-red-600 mt-1">
                                {errors.password.message}
                            </p>
                        ) : null}
                    </div>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full rounded-md bg-slate-900 text-white text-sm font-medium py-2.5 hover:bg-slate-800 disabled:opacity-60"
                    >
                        {isSubmitting ? "Connexion…" : "Se connecter"}
                    </button>
                </form>
            </div>
        </div>
    );
}
