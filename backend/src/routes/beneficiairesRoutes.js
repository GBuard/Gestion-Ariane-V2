import { Router } from "express";
import { body, param, query } from "express-validator";
import {
    listBeneficiaires,
    getBeneficiaire,
    createBeneficiaire,
    updateBeneficiaire,
    archiveBeneficiaire,
    destroyBeneficiairePermanent,
} from "../controllers/beneficiairesController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/roleMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

const router = Router();

const adminOnly = [requireAuth, requireRole("admin")];
const adminOrReferent = [requireAuth, requireRole("admin", "referent")];

router.get(
    "/",
    ...adminOrReferent,
    [
        query("q").optional().isString(),
        query("referentId").optional().isMongoId(),
        query("sort")
            .optional()
            .isIn(["lastName", "firstName", "email"]),
        query("order").optional().isIn(["asc", "desc"]),
        query("includeArchived").optional().isIn(["true", "1", "false", "0"]),
    ],
    validateRequest,
    asyncHandler(listBeneficiaires),
);

router.get(
    "/:id",
    ...adminOrReferent,
    [param("id").isMongoId()],
    validateRequest,
    asyncHandler(getBeneficiaire),
);

router.post(
    "/:id/destroy",
    ...adminOnly,
    [param("id").isMongoId()],
    validateRequest,
    asyncHandler(destroyBeneficiairePermanent),
);

router.post(
    "/",
    ...adminOnly,
    [
        body("firstName").trim().notEmpty(),
        body("lastName").trim().notEmpty(),
        body("email")
            .optional({ checkFalsy: true })
            .isEmail()
            .normalizeEmail(),
        body("phone").optional().isString().trim(),
        body("notes").optional().isString(),
        body("referentId").isMongoId(),
    ],
    validateRequest,
    asyncHandler(createBeneficiaire),
);

router.put(
    "/:id",
    ...adminOnly,
    [
        param("id").isMongoId(),
        body("firstName").optional().trim().notEmpty(),
        body("lastName").optional().trim().notEmpty(),
        body("email")
            .optional({ checkFalsy: true })
            .isEmail()
            .normalizeEmail(),
        body("phone").optional().isString().trim(),
        body("notes").optional().isString(),
        body("referentId").optional().isMongoId(),
        body("isArchived").optional().isBoolean(),
    ],
    validateRequest,
    asyncHandler(updateBeneficiaire),
);

router.delete(
    "/:id",
    ...adminOnly,
    [param("id").isMongoId()],
    validateRequest,
    asyncHandler(archiveBeneficiaire),
);

export default router;
