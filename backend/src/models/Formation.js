import mongoose from "mongoose";

const formationSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        trainerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
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
        isArchived: { type: Boolean, default: false },
        color: {
            type: String,
            default: "#3B82F6",
            trim: true,
        },
    },
    { timestamps: true },
);

formationSchema.index({ title: 1 });
formationSchema.index({ isArchived: 1 });

export const Formation = mongoose.model("Formation", formationSchema);
