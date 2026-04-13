import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User, USER_ROLES } from "../models/User.js";
import { userPublic } from "../utils/userPublic.js";

export async function listUsers(req, res) {
    const users = await User.find().sort({ lastName: 1, firstName: 1 });
    res.json({ users: users.map((u) => userPublic(u)) });
}

export async function createUser(req, res) {
    const { firstName, lastName, email, password, role } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();

    const dup = await User.findOne({ email: normalizedEmail });
    if (dup) {
        return res.status(409).json({ message: "Cet email est déjà utilisé" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        passwordHash,
        role,
        isActive: true,
    });

    res.status(201).json({ user: userPublic(user) });
}

export async function updateUser(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    const user = await User.findById(id).select("+passwordHash");
    if (!user) {
        return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    const {
        firstName,
        lastName,
        email,
        password,
        role,
        isActive,
    } = req.body;

    if (firstName !== undefined) user.firstName = String(firstName).trim();
    if (lastName !== undefined) user.lastName = String(lastName).trim();

    if (email !== undefined) {
        const normalizedEmail = String(email).trim().toLowerCase();
        if (normalizedEmail !== user.email) {
            const dup = await User.findOne({ email: normalizedEmail });
            if (dup) {
                return res.status(409).json({ message: "Cet email est déjà utilisé" });
            }
            user.email = normalizedEmail;
        }
    }

    if (password !== undefined && password !== "") {
        user.passwordHash = await bcrypt.hash(password, 10);
    }

    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = Boolean(isActive);

    await user.save();
    const fresh = await User.findById(user._id);
    res.json({ user: userPublic(fresh) });
}

export async function deleteUser(req, res) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Identifiant invalide" });
    }

    if (id === req.userId) {
        return res.status(400).json({
            message: "Vous ne pouvez pas supprimer votre propre compte",
        });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
        return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    res.status(204).send();
}
