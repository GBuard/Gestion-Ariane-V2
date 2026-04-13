import mongoose from "mongoose";
import { Seance } from "../models/Seance.js";

/**
 * Chevauchement : même salle, séances non archivées, intervalles qui se croisent.
 */
export async function assertNoRoomOverlap(
    salleId,
    startDate,
    endDate,
    excludeSeanceId,
) {
    const filter = {
        salleId,
        isArchived: false,
        startDate: { $lt: endDate },
        endDate: { $gt: startDate },
    };
    if (excludeSeanceId && mongoose.isValidObjectId(excludeSeanceId)) {
        filter._id = { $ne: excludeSeanceId };
    }
    const clash = await Seance.findOne(filter).select("_id");
    if (clash) {
        const err = new Error(
            "Cette salle est déjà réservée sur une partie de ce créneau",
        );
        err.statusCode = 409;
        throw err;
    }
}
