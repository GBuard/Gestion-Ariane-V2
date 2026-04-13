import { Router } from "express";
import { body, param, query } from "express-validator";
import {
    listSeances,
    listCalendarEvents,
    getSeanceFeuilleEmargement,
    getSeance,
    createSeance,
    updateSeance,
    archiveSeance,
    destroySeancePermanent,
} from "../controllers/seancesController.js";
import { SALLE_AGENCES } from "../models/Salle.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/roleMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

const router = Router();

const adminOnly = [requireAuth, requireRole("admin")];
const adminReferentFormateur = [
    requireAuth,
    requireRole("admin", "referent", "formateur"),
];

router.get(
    "/",
    ...adminReferentFormateur,
    [
        query("formationId").optional().isMongoId(),
        query("q").optional().isString(),
        query("sort")
            .optional()
            .isIn([
                "startDate",
                "startDate_desc",
                "formationTitle",
                "formationTitle_desc",
            ]),
        query("period").optional().isIn(["past", "upcoming"]),
        query("includeArchived").optional().isIn(["true", "1", "false", "0"]),
    ],
    validateRequest,
    asyncHandler(listSeances),
);

router.get(
    "/calendar",
    ...adminReferentFormateur,
    [
        query("agence")
            .optional()
            .isIn(SALLE_AGENCES),
    ],
    validateRequest,
    asyncHandler(listCalendarEvents),
);

router.get(
    "/:id/feuille-emargement",
    ...adminReferentFormateur,
    [param("id").isMongoId()],
    validateRequest,
    asyncHandler(getSeanceFeuilleEmargement),
);

router.post(
    "/:id/destroy",
    ...adminOnly,
    [param("id").isMongoId()],
    validateRequest,
    asyncHandler(destroySeancePermanent),
);

router.get(
    "/:id",
    ...adminReferentFormateur,
    [param("id").isMongoId()],
    validateRequest,
    asyncHandler(getSeance),
);

router.post(
    "/",
    ...adminOnly,
    [
        body("formationId").isMongoId(),
        body("salleId").isMongoId(),
        body("startDate").isISO8601(),
        body("endDate").isISO8601(),
        body("capacity")
            .optional({ nullable: true })
            .custom((v) => {
                if (v === undefined || v === null || v === "") return true;
                const n = Number(v);
                return Number.isInteger(n) && n >= 1;
            })
            .withMessage("Capacité invalide"),
        body("notes").optional().isString(),
    ],
    validateRequest,
    asyncHandler(createSeance),
);

router.put(
    "/:id",
    ...adminOnly,
    [
        param("id").isMongoId(),
        body("formationId").optional().isMongoId(),
        body("salleId").optional().isMongoId(),
        body("startDate").optional().isISO8601(),
        body("endDate").optional().isISO8601(),
        body("capacity")
            .optional({ nullable: true })
            .custom((v) => {
                if (v === undefined || v === null || v === "") return true;
                const n = Number(v);
                return Number.isInteger(n) && n >= 1;
            })
            .withMessage("Capacité invalide"),
        body("notes").optional().isString(),
        body("isArchived").optional().isBoolean(),
    ],
    validateRequest,
    asyncHandler(updateSeance),
);

router.delete(
    "/:id",
    ...adminOnly,
    [param("id").isMongoId()],
    validateRequest,
    asyncHandler(archiveSeance),
);

export default router;
