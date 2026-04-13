import mongoose from "mongoose";

export const SALLE_AGENCES = ["jean_moulin", "strasbourg"];

const salleSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        /** Site : calendriers séparés (chevauchements même horaire). */
        agence: {
            type: String,
            enum: SALLE_AGENCES,
            default: "jean_moulin",
        },
        capacity: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: Number.isInteger,
                message: "La capacité doit être un entier",
            },
        },
        location: { type: String, trim: true, default: "" },
        isArchived: { type: Boolean, default: false },
    },
    { timestamps: true },
);

salleSchema.index({ name: 1 });
salleSchema.index({ isArchived: 1 });

export const Salle = mongoose.model("Salle", salleSchema);
