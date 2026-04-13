/**
 * Middleware d’erreur global (à monter en dernier sur l’app).
 */
export function errorHandler(err, req, res, _next) {
    console.error(err);

    if (err.name === "CastError") {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const status = err.statusCode || err.status || 500;
    const message =
        status === 500 ? "Erreur serveur" : err.message || "Erreur serveur";

    return res.status(status).json({ message });
}
