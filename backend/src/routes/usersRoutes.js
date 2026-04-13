import { Router } from "express";
import { body, param } from "express-validator";
import {
    listUsers,
    createUser,
    updateUser,
    deleteUser,
} from "../controllers/usersController.js";
import { USER_ROLES } from "../models/User.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/roleMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

const router = Router();

const adminOnly = [requireAuth, requireRole("admin")];

router.get("/", ...adminOnly, asyncHandler(listUsers));

router.post(
    "/",
    ...adminOnly,
    [
        body("firstName").trim().notEmpty(),
        body("lastName").trim().notEmpty(),
        body("email").isEmail().normalizeEmail(),
        body("password").isString().isLength({ min: 8 }),
        body("role").isIn(USER_ROLES),
    ],
    validateRequest,
    asyncHandler(createUser),
);

router.put(
    "/:id",
    ...adminOnly,
    [
        param("id").isMongoId(),
        body("firstName").optional().trim().notEmpty(),
        body("lastName").optional().trim().notEmpty(),
        body("email").optional().isEmail().normalizeEmail(),
        body("password")
            .optional()
            .isString()
            .isLength({ min: 8 })
            .withMessage("Le mot de passe doit contenir au moins 8 caractères"),
        body("role").optional().isIn(USER_ROLES),
        body("isActive").optional().isBoolean(),
    ],
    validateRequest,
    asyncHandler(updateUser),
);

router.delete(
    "/:id",
    ...adminOnly,
    [param("id").isMongoId()],
    validateRequest,
    asyncHandler(deleteUser),
);

export default router;
