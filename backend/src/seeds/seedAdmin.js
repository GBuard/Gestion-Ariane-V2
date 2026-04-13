import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const firstName = (process.env.SEED_ADMIN_FIRST_NAME || 'Admin').trim();
  const lastName = (process.env.SEED_ADMIN_LAST_NAME || 'Ariane').trim();

  if (!email || !password) {
    console.error(
      'Définir SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD dans backend/.env puis relancer.'
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('SEED_ADMIN_PASSWORD doit contenir au moins 8 caractères.');
    process.exit(1);
  }

  await connectDB();

  const force =
    process.env.SEED_ADMIN_FORCE === 'true' ||
    process.env.SEED_ADMIN_FORCE === '1';

  const existing = await User.findOne({ email });
  if (existing) {
    if (force) {
      const passwordHash = await bcrypt.hash(password, 10);
      await User.updateOne(
        { _id: existing._id },
        {
          $set: {
            passwordHash,
            firstName,
            lastName,
            role: 'admin',
            isActive: true,
          },
        }
      );
      console.log(
        `Compte existant mis à jour (mot de passe + infos) : ${email} — pense à remettre SEED_ADMIN_FORCE à false ou à supprimer cette ligne.`
      );
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(
      `Un utilisateur existe déjà avec l’email ${email}. Aucune modification.`
    );
    console.log(
      'Pour appliquer SEED_ADMIN_PASSWORD sur ce compte : SEED_ADMIN_FORCE=true dans .env puis relance npm run seed:admin'
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    firstName,
    lastName,
    email,
    passwordHash,
    role: 'admin',
    isActive: true,
  });

  console.log(`Compte administrateur créé : ${email}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
