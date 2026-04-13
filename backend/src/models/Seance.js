import mongoose from "mongoose";

const seanceSchema = new mongoose.Schema(
    {
        formationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Formation",
            required: true,
        },
        salleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Salle",
            required: true,
        },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        capacity: {
            type: Number,
            default: null,
            validate: {
                validator(v) {
                    return v == null || (Number.isInteger(v) && v >= 1);
                },
                message: "Capacité doit être un entier ≥ 1 ou vide",
            },
        },
        notes: { type: String, default: "" },
        isArchived: { type: Boolean, default: false },
    },
    { timestamps: true },
);

seanceSchema.index({ salleId: 1, startDate: 1, endDate: 1 });
seanceSchema.index({ formationId: 1 });
seanceSchema.index({ isArchived: 1, startDate: 1 });

export const Seance = mongoose.model("Seance", seanceSchema);
