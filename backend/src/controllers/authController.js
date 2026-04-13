import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { signAccessToken } from "../utils/jwt.js";
import { userPublic } from "../utils/userPublic.js";

export async function login(req, res) {
    const email = String(req.body.email || "")
        .trim()
        .toLowerCase();
    const password = req.body.password;

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !user.isActive) {
        return res
            .status(401)
            .json({ message: "Email ou mot de passe incorrect" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
        return res
            .status(401)
            .json({ message: "Email ou mot de passe incorrect" });
    }

    const token = signAccessToken(user._id.toString());
    return res.json({
        token,
        user: userPublic(user),
    });
}

export async function me(req, res) {
    const user = await User.findById(req.userId);
    if (!user || !user.isActive) {
        return res
            .status(401)
            .json({ message: "Utilisateur introuvable ou inactif" });
    }
    return res.json({ user: userPublic(user) });
}
