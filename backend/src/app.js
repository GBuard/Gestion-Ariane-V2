import express from "express";
import helmet from "helmet";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import usersRoutes from "./routes/usersRoutes.js";
import beneficiairesRoutes from "./routes/beneficiairesRoutes.js";
import formationsRoutes from "./routes/formationsRoutes.js";
import sallesRoutes from "./routes/sallesRoutes.js";
import seancesRoutes from "./routes/seancesRoutes.js";
import inscriptionsRoutes from "./routes/inscriptionsRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

const frontendUrl = process.env.FRONTEND_URL;

app.use(helmet());
app.use(
    cors({
        origin: frontendUrl ? [frontendUrl] : true,
        credentials: true,
    }),
);
app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        service: "gestion-ariane-api",
        env: process.env.NODE_ENV || "development",
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/beneficiaires", beneficiairesRoutes);
app.use("/api/formations", formationsRoutes);
app.use("/api/salles", sallesRoutes);
app.use("/api/seances", seancesRoutes);
app.use("/api/inscriptions", inscriptionsRoutes);
app.use("/api/stats", statsRoutes);

app.use(errorHandler);

export default app;
