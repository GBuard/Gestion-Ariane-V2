import mongoose from "mongoose";
import { Beneficiaire } from "../models/Beneficiaire.js";
import { User } from "../models/User.js";
import { Inscription } from "../models/Inscription.js";
import { beneficiairePublic } from "../utils/beneficiairePublic.js";

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function assertReferentUser(referentId) {
    const ref = await User.findById(referentId);
    if (!ref || !ref.isActive || ref.role !== "referent") {
        const err = new Error("Référent invalide ou compte inactif");
        err.statusCode = 400;
        throw err;
    }
}

export async function listBeneficiaires(req, res) {
    const includeArchived =
        req.query.includeArchived === "true" || req.query.includeArchived === "1";
    const filter = {};

    if (req.user.role === "admin") {
        if (!includeArchived) {
            filter.isArchived = false;
        }
    } else {
        filter.referentId = req.user._id;
        filter.isArchived = false;
    }

    const { q, referentId, sort, order } = req.query;

    if (req.user.role === "admin" && referentId) {
        if (!mongoose.isValidObjectId(referentId)) {
            return res.status(400).json({ message: "referentId invalide" });
        }
        filter.referentId = referentId;
    }

    if (q && String(q).trim()) {
        const rx = new RegExp(escapeRegex(String(q).trim()), "i");
        filter.$or = [
            { firstName: rx },
            { lastName: rx },
            { email: rx },
        ];
    }

    const ord = order === "desc" ? -1 : 1;
    let sortSpec = { lastName: ord, firstName: ord };
    if (sort === "firstName") {
        sortSpec = { firstName: ord, lastName: ord };
    } else if (sort === "lastName") {
        sortSpec = { lastName: ord, firstName: ord };
    } else if (sort === "email") {
        sortSpec = { email: ord, lastName: 1, firstName: 1 };
    }

    const list = await Beneficiaire.find(filter).sort(sortSpec);
    res.json({ beneficiaires: list.map((b) => beneficiairePublic(b)) });
}

export async function getBeneficiaire(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const b = await Beneficiaire.findById(id);
    if (!b) {
        return res.status(404).json({ message: "Bénéficiaire introuvable" });
    }

    if (req.user.role !== "admin") {
        if (b.referentId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Accès refusé" });
        }
        if (b.isArchived) {
            return res.status(404).json({ message: "Bénéficiaire introuvable" });
        }
    }

    res.json({ beneficiaire: beneficiairePublic(b) });
}

export async function createBeneficiaire(req, res) {
    const { firstName, lastName, email, phone, notes, referentId } = req.body;

    await assertReferentUser(referentId);

    const b = await Beneficiaire.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email ? String(email).trim().toLowerCase() : "",
        phone: phone ? String(phone).trim() : "",
        notes: notes != null ? String(notes) : "",
        referentId,
        isArchived: false,
    });

    res.status(201).json({ beneficiaire: beneficiairePublic(b) });
}

export async function updateBeneficiaire(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const b = await Beneficiaire.findById(id);
    if (!b) {
        return res.status(404).json({ message: "Bénéficiaire introuvable" });
    }

    const { firstName, lastName, email, phone, notes, referentId, isArchived } =
        req.body;

    if (firstName !== undefined) b.firstName = String(firstName).trim();
    if (lastName !== undefined) b.lastName = String(lastName).trim();
    if (email !== undefined) {
        b.email = email ? String(email).trim().toLowerCase() : "";
    }
    if (phone !== undefined) b.phone = phone ? String(phone).trim() : "";
    if (notes !== undefined) b.notes = String(notes);
    if (referentId !== undefined) {
        await assertReferentUser(referentId);
        b.referentId = referentId;
    }
    if (isArchived !== undefined) b.isArchived = Boolean(isArchived);

    await b.save();
    const fresh = await Beneficiaire.findById(b._id);
    res.json({ beneficiaire: beneficiairePublic(fresh) });
}

/**
 * Archive logique (cahier des charges : archiver plutôt que supprimer).
 */
export async function archiveBeneficiaire(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const b = await Beneficiaire.findByIdAndUpdate(
        id,
        { $set: { isArchived: true } },
        { new: true },
    );
    if (!b) {
        return res.status(404).json({ message: "Bénéficiaire introuvable" });
    }

    res.status(204).send();
}

/**
 * Suppression définitive (page archives) : réservé aux bénéficiaires déjà archivés.
 */
export async function destroyBeneficiairePermanent(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const b = await Beneficiaire.findById(id);
    if (!b || !b.isArchived) {
        return res.status(400).json({
            message:
                "Seuls les bénéficiaires archivés peuvent être supprimés définitivement",
        });
    }

    await Inscription.deleteMany({ beneficiaireId: id });
    await Beneficiaire.findByIdAndDelete(id);
    res.status(204).send();
}
