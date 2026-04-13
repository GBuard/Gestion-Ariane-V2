import mongoose from 'mongoose';

/**
 * Connexion MongoDB (une seule connexion par process Node).
 */
export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI manquant dans les variables d’environnement');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri);
}
