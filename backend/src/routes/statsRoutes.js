import { Router } from "express";
import { query } from "express-validator";
import {
    getDashboard,
    getGlobal,
    getWorkshopsStats,
} from "../controllers/statsController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/roleMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

const router = Router();

const statsReaders = [
    requireAuth,
    requireRole("admin", "referent", "formateur"),
];

router.get("/dashboard", ...statsReaders, asyncHandler(getDashboard));
router.get("/global", ...statsReaders, asyncHandler(getGlobal));

router.get(
    "/workshops",
    ...statsReaders,
    [
        query("month").optional().matches(/^\d{4}-\d{2}$/),
        query("from").optional().matches(/^\d{4}-\d{2}-\d{2}$/),
        query("to").optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    ],
    validateRequest,
    asyncHandler(getWorkshopsStats),
);

export default router;
