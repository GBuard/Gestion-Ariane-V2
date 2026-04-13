import mongoose from "mongoose";

const beneficiaireSchema = new mongoose.Schema(
    {
        firstName: { type: String, required: true, trim: true },
        lastName: { type: String, required: true, trim: true },
        email: { type: String, trim: true, lowercase: true, default: "" },
        phone: { type: String, trim: true, default: "" },
        referentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        notes: { type: String, default: "" },
        isArchived: { type: Boolean, default: false },
    },
    { timestamps: true },
);

beneficiaireSchema.index({ referentId: 1, isArchived: 1 });
beneficiaireSchema.index({ lastName: 1, firstName: 1 });

export const Beneficiaire = mongoose.model("Beneficiaire", beneficiaireSchema);
