import mongoose from "mongoose";
import { Salle } from "../models/Salle.js";
import { sallePublic } from "../utils/sallePublic.js";

export async function listSalles(req, res) {
    const includeArchived =
        req.query.includeArchived === "true" || req.query.includeArchived === "1";
    const filter = {};

    if (req.user.role === "admin") {
        if (!includeArchived) {
            filter.isArchived = false;
        }
    } else {
        filter.isArchived = false;
    }

    const list = await Salle.find(filter).sort({ name: 1 });
    res.json({ salles: list.map((s) => sallePublic(s)) });
}

export async function getSalle(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const s = await Salle.findById(id);
    if (!s) {
        return res.status(404).json({ message: "Salle introuvable" });
    }

    if (req.user.role !== "admin" && s.isArchived) {
        return res.status(404).json({ message: "Salle introuvable" });
    }

    res.json({ salle: sallePublic(s) });
}

export async function createSalle(req, res) {
    const { name, capacity, location, agence } = req.body;

    const s = await Salle.create({
        name: name.trim(),
        capacity: Number(capacity),
        location: location != null ? String(location).trim() : "",
        agence:
            agence === "strasbourg" || agence === "jean_moulin"
                ? agence
                : "jean_moulin",
        isArchived: false,
    });

    res.status(201).json({ salle: sallePublic(s) });
}

export async function updateSalle(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const s = await Salle.findById(id);
    if (!s) {
        return res.status(404).json({ message: "Salle introuvable" });
    }

    const { name, capacity, location, agence, isArchived } = req.body;

    if (name !== undefined) s.name = String(name).trim();
    if (capacity !== undefined) s.capacity = Number(capacity);
    if (location !== undefined) s.location = String(location).trim();
    if (agence !== undefined) {
        s.agence =
            agence === "strasbourg" || agence === "jean_moulin"
                ? agence
                : s.agence;
    }
    if (isArchived !== undefined) s.isArchived = Boolean(isArchived);

    await s.save();
    const fresh = await Salle.findById(s._id);
    res.json({ salle: sallePublic(fresh) });
}

export async function archiveSalle(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const s = await Salle.findByIdAndUpdate(
        id,
        { $set: { isArchived: true } },
        { new: true },
    );
    if (!s) {
        return res.status(404).json({ message: "Salle introuvable" });
    }

    res.status(204).send();
}
