import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

const port = Number(process.env.PORT) || 5000;

async function start() {
  try {
    await connectDB();
    console.log('MongoDB connecté');

    app.listen(port, () => {
      console.log(`API Gestion Ariane — http://localhost:${port}`);
      console.log(`Santé : http://localhost:${port}/api/health`);
    });
  } catch (err) {
    console.error('Échec au démarrage :', err.message);
    process.exit(1);
  }
}

start();
