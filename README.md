# Gestion Ariane V2

Application web interne pour Ariane Méditerranée.

## Objectif

Cette application permet de gérer :

- les bénéficiaires
- les référents / utilisateurs
- les formations
- les séances
- les salles
- les inscriptions
- le calendrier
- les statistiques
- l’archive

## Stack technique

### Frontend

- React
- Vite
- Tailwind CSS
- React Router
- Axios
- React Hook Form
- Zod
- TanStack Query
- FullCalendar

### Backend

- Node.js
- Express
- MongoDB / Mongoose
- JWT
- bcryptjs
- Helmet
- Cors
- dotenv
- express-validator

## Structure du projet

gestion-ariane-v2/

- backend/
- frontend/
- docs/

## Hébergement

- Backend : VPS OVH
- API : https://api.ariane-mediterranee.fr
- Frontend : https://app.ariane-mediterranee.fr

## Phases du projet

### Phase 1 — Backend

- Connexion MongoDB
- Auth JWT
- Seed admin
- CRUD bénéficiaires
- CRUD formations
- CRUD salles
- CRUD séances
- CRUD inscriptions

### Phase 2 — Frontend

- Login
- Dashboard
- Sidebar
- CRUD pages principales

### Phase 3 — Fonctionnalités métier

- Calendrier
- Affectations
- Historique
- Statistiques
- Archive

### Phase 4 — Déploiement

- Déploiement backend sur VPS
- Déploiement frontend
- Vérifications finales

## Règle du projet

Ne jamais déployer quelque chose qui ne fonctionne pas déjà parfaitement en local.
