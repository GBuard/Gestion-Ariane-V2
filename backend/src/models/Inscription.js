import mongoose from "mongoose";

export const INSCRIPTION_STATUSES = [
    "inscrit",
    "present",
    "absent",
    "absent_excused",
    "annule",
];

const inscriptionSchema = new mongoose.Schema(
    {
        beneficiaireId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Beneficiaire",
            required: true,
        },
        formationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Formation",
            required: true,
        },
        seanceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seance",
            default: null,
        },
        status: {
            type: String,
            enum: INSCRIPTION_STATUSES,
            default: "inscrit",
        },
        /** Message optionnel laissé par le référent à l’inscription. */
        message: { type: String, default: "", trim: true },
    },
    { timestamps: true },
);

inscriptionSchema.index(
    { beneficiaireId: 1, formationId: 1, seanceId: 1 },
    { unique: true },
);

inscriptionSchema.index({ formationId: 1 });
inscriptionSchema.index({ beneficiaireId: 1 });

export const Inscription = mongoose.model("Inscription", inscriptionSchema);
