import { Router } from "express";
import { body, param } from "express-validator";
import {
    listFormations,
    getFormation,
    createFormation,
    updateFormation,
    archiveFormation,
    destroyFormation,
} from "../controllers/formationsController.js";
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

router.get("/", ...adminReferentFormateur, asyncHandler(listFormations));

router.post(
    "/:id/destroy",
    ...adminOnly,
    [param("id").isMongoId()],
    validateRequest,
    asyncHandler(destroyFormation),
);

router.get(
    "/:id",
    ...adminReferentFormateur,
    [param("id").isMongoId()],
    validateRequest,
    asyncHandler(getFormation),
);

router.post(
    "/",
    ...adminOnly,
    [
        body("title").trim().notEmpty(),
        body("description").optional().isString(),
        body("trainerId").isMongoId(),
        body("capacity")
            .optional({ nullable: true })
            .custom((v) => {
                if (v === undefined || v === null || v === "") return true;
                const n = Number(v);
                return Number.isInteger(n) && n >= 1;
            })
            .withMessage("Capacité invalide (entier ≥ 1 ou omis)"),
        body("color").optional({ nullable: true }).isString(),
        body("recurrence").optional({ nullable: true }).isObject(),
    ],
    validateRequest,
    asyncHandler(createFormation),
);

router.put(
    "/:id",
    ...adminOnly,
    [
        param("id").isMongoId(),
        body("title").optional().trim().notEmpty(),
        body("description").optional().isString(),
        body("trainerId").optional().isMongoId(),
        body("capacity")
            .optional({ nullable: true })
            .custom((value) => {
                if (value === null || value === "") return true;
                const n = Number(value);
                return Number.isInteger(n) && n >= 1;
            })
            .withMessage("Capacité invalide (entier ≥ 1 ou null)"),
        body("isArchived").optional().isBoolean(),
        body("color").optional({ nullable: true }).isString(),
        body("recurrence").optional({ nullable: true }).isObject(),
    ],
    validateRequest,
    asyncHandler(updateFormation),
);

router.delete(
    "/:id",
    ...adminOnly,
    [param("id").isMongoId()],
    validateRequest,
    asyncHandler(archiveFormation),
);

export default router;
