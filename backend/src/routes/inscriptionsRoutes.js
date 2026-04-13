import { Router } from "express";
import mongoose from "mongoose";
import { body, param, query } from "express-validator";
import {
    listInscriptions,
    listByBeneficiaire,
    listByFormation,
    listBySeance,
    createInscription,
    createInscriptionsBulk,
    updateInscription,
    deleteInscription,
} from "../controllers/inscriptionsController.js";
import { INSCRIPTION_STATUSES } from "../models/Inscription.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/roleMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

const router = Router();

const allRoles = [
    requireAuth,
    requireRole("admin", "referent", "formateur"),
];

const adminReferent = [requireAuth, requireRole("admin", "referent")];

router.get(
    "/beneficiaire/:beneficiaireId",
    ...allRoles,
    [param("beneficiaireId").isMongoId()],
    validateRequest,
    asyncHandler(listByBeneficiaire),
);

router.get(
    "/formation/:formationId",
    ...allRoles,
    [param("formationId").isMongoId()],
    validateRequest,
    asyncHandler(listByFormation),
);

router.get(
    "/seance/:seanceId",
    ...allRoles,
    [param("seanceId").isMongoId()],
    validateRequest,
    asyncHandler(listBySeance),
);

router.get(
    "/",
    ...allRoles,
    [
        query("beneficiaireId").optional().isMongoId(),
        query("formationId").optional().isMongoId(),
    ],
    validateRequest,
    asyncHandler(listInscriptions),
);

router.post(
    "/bulk",
    ...adminReferent,
    [
        body("beneficiaireId").isMongoId(),
        body("formationId").isMongoId(),
        body("nextSeancesCount")
            .optional({ nullable: true })
            .isInt({ min: 1 })
            .toInt(),
        body("allSeances").optional().isBoolean(),
        body("seanceId")
            .optional({ nullable: true })
            .custom((v) => {
                if (v === undefined || v === null || v === "") return true;
                return mongoose.isValidObjectId(v);
            })
            .withMessage("seanceId invalide"),
        body("status").optional().isIn(INSCRIPTION_STATUSES),
    ],
    validateRequest,
    asyncHandler(createInscriptionsBulk),
);

router.post(
    "/",
    ...adminReferent,
    [
        body("beneficiaireId").isMongoId(),
        body("formationId").isMongoId(),
        body("seanceId")
            .optional({ nullable: true })
            .custom((v) => {
                if (v === undefined || v === null || v === "") return true;
                return mongoose.isValidObjectId(v);
            })
            .withMessage("seanceId invalide"),
        body("status").optional().isIn(INSCRIPTION_STATUSES),
    ],
    validateRequest,
    asyncHandler(createInscription),
);

router.put(
    "/:id",
    ...allRoles,
    [
        param("id").isMongoId(),
        body("status").optional().isIn(INSCRIPTION_STATUSES),
        body("attachSeanceId")
            .optional({ nullable: true })
            .custom((v) => {
                if (v === undefined || v === null || v === "") return true;
                return mongoose.isValidObjectId(v);
            })
            .withMessage("attachSeanceId invalide"),
    ],
    validateRequest,
    asyncHandler(updateInscription),
);

router.delete(
    "/:id",
    ...adminReferent,
    [param("id").isMongoId()],
    validateRequest,
    asyncHandler(deleteInscription),
);

export default router;
