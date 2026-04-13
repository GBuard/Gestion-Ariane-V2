import { Router } from "express";
import { body, param } from "express-validator";
import {
    listSalles,
    getSalle,
    createSalle,
    updateSalle,
    archiveSalle,
} from "../controllers/sallesController.js";
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

router.get("/", ...adminReferentFormateur, asyncHandler(listSalles));

router.get(
    "/:id",
    ...adminReferentFormateur,
    [param("id").isMongoId()],
    validateRequest,
    asyncHandler(getSalle),
);

router.post(
    "/",
    ...adminOnly,
    [
        body("name").trim().notEmpty(),
        body("capacity").isInt({ min: 1 }).toInt(),
        body("location").optional().isString().trim(),
        body("agence").optional().isIn(SALLE_AGENCES),
    ],
    validateRequest,
    asyncHandler(createSalle),
);

router.put(
    "/:id",
    ...adminOnly,
    [
        param("id").isMongoId(),
        body("name").optional().trim().notEmpty(),
        body("capacity").optional().isInt({ min: 1 }).toInt(),
        body("location").optional().isString().trim(),
        body("agence").optional().isIn(SALLE_AGENCES),
        body("isArchived").optional().isBoolean(),
    ],
    validateRequest,
    asyncHandler(updateSalle),
);

router.delete(
    "/:id",
    ...adminOnly,
    [param("id").isMongoId()],
    validateRequest,
    asyncHandler(archiveSalle),
);

export default router;
