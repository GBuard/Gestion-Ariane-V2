# Brief de reprise — Gestion Ariane V2

**Public cible :** IA / développeur reprenant le projet sans historique conversationnel.  
**Date de rédaction :** 2026-09-03 (état du dépôt local + déploiement VPS connu).  
**Repo :** monorepo `Gestion-Ariane-V2` (`backend/` + `frontend/`).  
**Règle projet :** ne jamais déployer quelque chose qui ne fonctionne pas déjà parfaitement en local.

---

## 0. Instructions pour l’IA qui reprend

1. Lire ce brief en entier avant de modifier le code.
2. Travailler en français avec l’utilisateur.
3. Respecter l’architecture existante (Express + Mongoose + React/Vite) ; ne pas introduire de framework alternatif sans demande explicite.
4. Les secrets (`.env`, mots de passe Mongo/JWT) ne sont **jamais** commités.
5. En production : front buildé avec `VITE_API_URL=https://api.ariane-mediterranee.fr` ; CORS via `FRONTEND_URL=https://app.ariane-mediterranee.fr`.
6. MongoDB est **documentaire** (collections Mongoose), pas SQL — parler de « collections », pas de « tables », sauf pour expliquer à un non-tech.
7. Fuseau métier des séances : **Europe/Paris**, lun–ven, **9h–17h**.
8. Soft-delete = `isArchived: true` ; suppression définitive réservée aux éléments **déjà archivés**, depuis la page Archives (admin).

---

## 1. Contexte métier

### 1.1 Organisation

**Ariane Méditerranée** est une structure (projet / association côté métier) qui anime des **ateliers / formations** pour des **bénéficiaires** (personnes accompagnées), souvent dans le cadre de dispositifs d’insertion / orientation (référence métier visible sur le modèle de feuille d’émargement : projet **DIRE**, cofinancements UE / Département du Var / Ariane Méditerranée).

Deux **sites / agences** de formation sont gérés dans l’appli :

| Code technique (`Salle.agence`) | Libellé UI |
|--------------------------------|------------|
| `jean_moulin` | Jean-Moulin (jusqu’à 2 salles de formation typiques) |
| `strasbourg` | Strasbourg |

### 1.2 Besoin d’origine

Remplacer / reconstruire une gestion artisanale (Excel, agendas dispersés, ancienne appli) par une **application web interne** permettant de :

- planifier des **formations** et leurs **séances** dans des **salles** sans double-réservation ;
- suivre les **bénéficiaires** et leurs **référents** ;
- **inscrire** les bénéficiaires aux ateliers / séances et noter la **présence** ;
- produire des **statistiques** (placements par référent, taux de présence) ;
- **archiver** et purger proprement ;
- exporter des **feuilles d’émargement** (impression HTML).

### 1.3 Utilisateurs concernés (rôles)

Trois rôles dans le modèle `User` :

| Rôle | Qui | Capacités principales |
|------|-----|------------------------|
| `admin` | Gestionnaire / back-office Ariane | CRUD complet, utilisateurs, archives, suppressions définitives, seed |
| `referent` | Référent de parcours | Voit / gère surtout **ses** bénéficiaires ; peut inscrire ; accès planning / stats dans le périmètre |
| `formateur` | Intervenant d’atelier | Accès limité aux **formations où il est `trainerId`** et aux séances associées ; peut marquer les présences |

### 1.4 Fonctionnement actuel de la réservation / planning

1. L’**admin** crée une **Formation** (titre, description, intervenant `trainerId`, capacité optionnelle, couleur calendrier).
2. À la création (et optionnellement à l’édition), une **récurrence** peut générer automatiquement des **Séances** :
   - période `periodStart` / `periodEnd` (`YYYY-MM-DD`) ;
   - fréquence `weekly` | `biweekly` | `monthly` ;
   - jour ISO `weekday` (1=lundi … 7=dimanche) ;
   - créneau `startTime` / `endTime` ;
   - `salleId`.
3. Une **Séance** = occurrence concrète : `formationId` + `salleId` + `startDate`/`endDate` (+ capacité / notes).
4. **Conflits salle** : impossible d’avoir deux séances **non archivées** qui se chevauchent sur **la même salle** (`assertNoRoomOverlap` → HTTP 409).
5. En revanche, **deux salles différentes** peuvent accueillir des ateliers **au même horaire** (d’où **deux calendriers** filtrés par `agence` de la salle).
6. Un **référent / admin** inscrit un bénéficiaire :
   - à **une** séance ; ou
   - aux **N prochaines** séances de la formation (`nextSeancesCount`) ; ou
   - à **toutes** les séances non archivées (`allSeances`).
7. Sur la fiche séance, on marque `present` / `absent` / `absent_excused` (et autres statuts d’inscription).
8. Export **feuille d’émargement** HTML depuis la fiche séance.

---

## 2. Objectifs de Gestion Ariane V2

Reconstruction **fullstack moderne** d’une ancienne logique de gestion, en phases :

| Phase | Contenu | Statut (selon README + livraisons) |
|-------|---------|-------------------------------------|
| 1 | Backend JWT, CRUD métier, seed admin | Fait |
| 2 | Frontend login, dashboard, CRUD pages | Fait |
| 3 | Calendrier, affectations, historique/archives, stats | Fait (évolutions post-phase) |
| 4 | Déploiement VPS OVH + HTTPS | Fait (prod live) |

Objectifs produit durables :

- Source de vérité unique pour planning ateliers / salles / inscriptions.
- UX interne claire (pas de site marketing).
- Prod robuste : Nginx + PM2 + Mongo local + HTTPS.

---

## 3. Fonctionnalités existantes (état réel du code)

### 3.1 Authentification

- Login email / mot de passe → JWT (`Bearer`).
- Token stocké côté front : `localStorage.ariane_token`.
- Endpoint `GET /api/auth/me` pour recharger la session.
- Seed admin : `npm run seed:admin` (variables `SEED_ADMIN_*` dans `backend/.env`).

### 3.2 Utilisateurs (`/utilisateurs`, admin only)

- Liste / création / mise à jour / désactivation (selon `usersRoutes`).
- Rôles : `admin`, `referent`, `formateur`.

### 3.3 Bénéficiaires

- CRUD admin ; référent limité à son périmètre (`referentId`).
- Recherche `q`, tri, archivage soft.
- Suppression définitive : `POST /api/beneficiaires/:id/destroy` **si déjà archivé** (page Archives).

### 3.4 Formations

- Liste enrichie : `trainerName`, `weekdayLabel`, `scheduleLabel` (dérivés des séances).
- Création avec récurrence optionnelle → génération de séances.
- Édition : champs classiques + option **régénérer la récurrence** (`recurrence` dans PUT) :
  - **supprime toutes les inscriptions** de la formation ;
  - **supprime toutes les séances** ;
  - recrée les créneaux.
- Archivage soft ; destroy définitif si archivée : `POST /api/formations/:id/destroy`.

### 3.5 Salles

- Nom, capacité, localisation, **`agence`** (`jean_moulin` | `strasbourg`), archivage.
- Pas d’archive « métier » dédiée côté UI Archives (volontaire : pas besoin d’archive salles dans la page Archives).

### 3.6 Séances & planning

- Liste avec filtres : formation, recherche, sort, `period=past|upcoming`, `includeArchived`.
- CRUD admin ; archivage soft.
- Contraintes horaires Paris (lun–ven, 9h–17h).
- Calendrier FullCalendar : filtre query `agence` ; événements avec titre formation + salle + compteurs d’inscrits.
- Fiche séance : inscriptions, présence, modes d’affectation, feuille d’émargement.
- Destroy définitif séance archivée : `POST /api/seances/:id/destroy` (supprime aussi les inscriptions **liées à ce `seanceId`** ; pas celles `seanceId: null`).

### 3.7 Inscriptions / « réservations »

Dans ce projet, la « réservation » d’atelier = **Inscription** (bénéficiaire ↔ formation ± séance), pas un module de booking générique.

Statuts : `inscrit` | `present` | `absent` | `absent_excused` | `annule`.

Index unique : `(beneficiaireId, formationId, seanceId)`.

`seanceId: null` = inscription « toute la formation » (héritage / fusion côté lecture séance : une ligne par bénéficiaire, priorité à l’inscription spécifique séance).

Bulk : `POST /api/inscriptions/bulk` avec `allSeances` **ou** `nextSeancesCount` **ou** `seanceId`.

### 3.8 Statistiques

- `GET /api/stats/dashboard` — KPI dashboard.
- `GET /api/stats/global` — totaux + répartition inscriptions par formation.
- `GET /api/stats/workshops` — période `month=YYYY-MM` **ou** `from`+`to` (`YYYY-MM-DD`, bornes Paris) :
  - **placements par référent** (bénéficiaires distincts touchés) ;
  - **présence moyenne par atelier** (% présent / inscrits non annulés, moyenné sur les séances de la période).

UI : page `/statistiques` (période mois ou plage + vue globale).

### 3.9 Archives & historique (`/historique`, libellé menu « Archives »)

Admin :

- Formations archivées (tri, séances liées, destroy).
- Bénéficiaires archivés (recherche, destroy).
- Séances archivées (tri, destroy).
- Séances **passées** (historique consultation).

Non-admin : séances passées seulement.

### 3.10 Feuille d’émargement

`GET /api/seances/:id/feuille-emargement` → HTML (atelier, lieu, date, horaires, liste NOM/PRÉNOM, formateur, cases signature). Ouverture depuis `SeanceDetail` (blob / nouvel onglet + impression).

---

## 4. Architecture technique réelle

### 4.1 Vue d’ensemble

```
Navigateur
    │
    ├─ https://app.ariane-mediterranee.fr  → Nginx → fichiers statiques Vite (frontend/dist)
    │
    └─ https://api.ariane-mediterranee.fr  → Nginx reverse proxy → Node/Express (PM2) :127.0.0.1:PORT
                                                    │
                                                    └─ MongoDB local (auth) :27017
```

### 4.2 Frontend

- **React 18** + **Vite 5** + **Tailwind 3**.
- **React Router 6** (routes dans `frontend/src/App.jsx`).
- **TanStack Query** pour le data-fetching.
- **Axios** (`frontend/src/lib/axios.js`) : `baseURL = import.meta.env.VITE_API_URL`.
- **React Hook Form + Zod** pour les formulaires.
- **FullCalendar** (week/month, locale FR, lun–ven, 9h–17h).
- Auth context : `frontend/src/context/AuthContext.jsx`.
- Layout : `DashboardLayout.jsx` (sidebar).
- Guards : `ProtectedRoute`, `AdminRoute`.

Pages principales :

| Route | Fichier | Rôle |
|-------|---------|------|
| `/login` | `Login.jsx` | Public |
| `/dashboard` | `Dashboard.jsx` | Auth |
| `/beneficiaires` | `Beneficiaires.jsx` | Auth (périmètre) |
| `/formations` | `Formations.jsx` | Auth ; CRUD admin |
| `/salles` | `Salles.jsx` | Auth ; CRUD admin |
| `/seances` | `Seances.jsx` | Auth ; CRUD admin |
| `/seances/:id` | `SeanceDetail.jsx` | Auth |
| `/calendrier` | `Calendrier.jsx` | Auth (2 onglets agence) |
| `/statistiques` | `Statistiques.jsx` | Auth |
| `/historique` | `Historique.jsx` | Auth (archives admin) |
| `/utilisateurs` | `Utilisateurs.jsx` | Admin only |

Clients API : `frontend/src/api/*.js`.

### 4.3 Backend

- **Node.js (ESM)** + **Express 4**.
- Entrée : `backend/src/server.js` → `connectDB()` + `app.listen(PORT)`.
- App : `backend/src/app.js` (Helmet, CORS, JSON, routes, errorHandler).
- Couches : `routes/` → `controllers/` → `models/` + `utils/`.
- Validation : **express-validator** + middleware `validateRequest`.
- Auth : JWT (`jsonwebtoken`) ; hash `bcryptjs`.
- Dates métier : `date-fns` + `date-fns-tz` (récurrence, stats workshops).

Structure backend :

```
backend/src/
  app.js, server.js
  config/db.js
  controllers/
  middlewares/   (auth, role, validate, asyncHandler, errorHandler)
  models/        (User, Beneficiaire, Formation, Salle, Seance, Inscription)
  routes/
  seeds/seedAdmin.js
  utils/         (public DTOs, jwt, recurrence, overlap, Paris schedule, merge inscriptions, seanceScope)
```

### 4.4 API (préfixe `/api`)

| Préfixe | Contenu |
|---------|---------|
| `GET /api/health` | Santé (public) |
| `/api/auth` | `POST /login`, `GET /me` |
| `/api/users` | Admin CRUD utilisateurs |
| `/api/beneficiaires` | CRUD + `POST /:id/destroy` |
| `/api/formations` | CRUD + `POST /:id/destroy` + récurrence create/update |
| `/api/salles` | CRUD (+ champ `agence`) |
| `/api/seances` | list, calendar, CRUD, feuille-emargement, destroy |
| `/api/inscriptions` | list by *, create, bulk, update status/attach, delete |
| `/api/stats` | dashboard, global, workshops |

CORS : si `FRONTEND_URL` est défini, **seule cette origine exacte** est autorisée.

### 4.5 Base de données

- **MongoDB** + **Mongoose 8**.
- Connexion : `process.env.MONGO_URI` (obligatoire).
- En prod VPS : souvent auth Mongo activée → URI du type  
  `mongodb://USER:PASS@127.0.0.1:27017/NOM_BASE?authSource=admin`.

### 4.6 Authentification (détail)

1. `POST /api/auth/login` → compare bcrypt → `signAccessToken(userId)`.
2. Front stocke le token et envoie `Authorization: Bearer …`.
3. `requireAuth` pose `req.userId` ; `requireRole(...)` charge `req.user` et vérifie le rôle + `isActive`.

---

## 5. Technologies et versions (package.json)

### Backend (`gestion-ariane-api`)

| Dépendance | Version (package.json) |
|------------|------------------------|
| express | ^4.21.0 |
| mongoose | ^8.7.0 |
| jsonwebtoken | ^9.0.2 |
| bcryptjs | ^2.4.3 |
| dotenv | ^16.4.5 |
| cors | ^2.8.5 |
| helmet | ^7.1.0 |
| express-validator | ^7.2.0 |
| date-fns | ^4.1.0 |
| date-fns-tz | ^3.2.0 |

Scripts : `npm run dev` (`node --watch`), `npm start`, `npm run seed:admin`.

### Frontend (`gestion-ariane-frontend`)

| Dépendance | Version |
|------------|---------|
| react / react-dom | ^18.3.1 |
| vite | ^5.4.8 |
| react-router-dom | ^6.26.2 |
| @tanstack/react-query | ^5.59.0 |
| axios | ^1.7.7 |
| react-hook-form | ^7.53.0 |
| zod | ^3.23.8 |
| @hookform/resolvers | ^3.9.0 |
| tailwindcss | ^3.4.13 |
| @fullcalendar/* | ^6.1.20 |

Scripts : `npm run dev` (port **5173**), `npm run build`, `npm run preview`.

---

## 6. Modèle de données (collections Mongo)

> Pas de SQL. Relations = ObjectId + refs Mongoose.

### 6.1 `User`

- `firstName`, `lastName`, `email` (unique), `passwordHash` (select:false), `role` enum, `isActive`, timestamps.

### 6.2 `Beneficiaire`

- Identité + `email`/`phone` optionnels, `referentId` → User, `notes`, `isArchived`.

### 6.3 `Formation`

- `title`, `description`, `trainerId` → User, `capacity` (nullable), `color`, `isArchived`.
- La récurrence **n’est pas persistée** en base : elle sert uniquement à **générer** des `Seance`.

### 6.4 `Salle`

- `name`, `agence` (`jean_moulin`|`strasbourg`), `capacity`, `location`, `isArchived`.

### 6.5 `Seance`

- `formationId`, `salleId`, `startDate`, `endDate`, `capacity` (nullable), `notes`, `isArchived`.
- Index utiles : salle+dates, formation, archivage+startDate.

### 6.6 `Inscription`

- `beneficiaireId`, `formationId`, `seanceId` (nullable), `status`.
- Unique compound sur les trois IDs.

### 6.7 Diagramme relationnel (logique)

```
User (referent) 1──* Beneficiaire
User (trainer)  1──* Formation
Formation       1──* Seance
Salle           1──* Seance
Beneficiaire    *──* Formation / Seance  via Inscription
```

---

## 7. Règles métier critiques (à ne pas casser)

1. **Horaires Paris** : `assertSeanceParisSchedule` — lun–ven, 9h–17h.
2. **Pas de chevauchement salle** : `assertNoRoomOverlap` — même `salleId`, séances non archivées.
3. **Calendrier multi-salles même créneau** : OK si salles différentes ; UI = 2 calendriers par `agence`.
4. **Régénération récurrence formation** : wipe inscriptions + séances puis recreate.
5. **Destroy** : uniquement si `isArchived === true` (formations, bénéficiaires, séances).
6. **Formateur** : scope séances via `applyFormateurSeanceScope` (formations où `trainerId` = lui).
7. **CORS prod** : `FRONTEND_URL` doit matcher **exactement** l’origine navigateur (https, hostname, pas de slash final typique).
8. **Vite** : `VITE_API_URL` est figée **au build** — tout changement impose un `npm run build` du front.

---

## 8. Déploiement

### 8.1 Développement local

```bash
# Backend
cd backend
cp .env.example .env   # renseigner MONGO_URI, JWT_SECRET, FRONTEND_URL=http://localhost:5173
npm install
npm run seed:admin     # si besoin
npm run dev            # :5000

# Frontend
cd frontend
cp .env.example .env   # VITE_API_URL=http://localhost:5000
npm install
npm run dev            # :5173
```

### 8.2 Production VPS OVH (état connu)

| Élément | Valeur / pratique |
|---------|-------------------|
| OS | Ubuntu 24.04 LTS |
| Chemin projet typique | `/var/www/Gestion-Ariane-V2` (ou variante `/var/www/ariane-v2`) |
| Process API | **PM2** (ex. app `ariane-api`, `src/server.js`) |
| Port API interne | `PORT` (souvent **5000**), bind localhost |
| Reverse proxy | **Nginx** |
| Front | Build Vite servi en static (`frontend/dist`) |
| Domaine app | `https://app.ariane-mediterranee.fr` |
| Domaine API | `https://api.ariane-mediterranee.fr` |
| SSL | **Let’s Encrypt / Certbot** (`certbot --nginx`) |
| MongoDB | Service `mongod`, bind `127.0.0.1:27017`, **authorization enabled** |
| Stratégie code | `git clone` / `git pull` sur le VPS (méthode recommandée) |

Routine déploiement typique :

```bash
cd /var/www/Gestion-Ariane-V2
git pull
cd backend && npm ci --omit=dev && pm2 restart ariane-api
cd ../frontend && npm ci && npm run build   # avec .env.production VITE_API_URL=https://api...
sudo systemctl reload nginx
```

### 8.3 Variables d’environnement

**Backend `.env` (jamais commit) — prod :**

```env
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb://USER:PASS@127.0.0.1:27017/NOM_BASE?authSource=admin
JWT_SECRET=<long_secret>
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://app.ariane-mediterranee.fr
# Optionnel seed :
# SEED_ADMIN_EMAIL=...
# SEED_ADMIN_PASSWORD=...  (>= 8 chars)
# SEED_ADMIN_FORCE=false
```

**Frontend `.env.production` :**

```env
VITE_API_URL=https://api.ariane-mediterranee.fr
```

Exemples locaux : `backend/.env.example`, `frontend/.env.example`.

### 8.4 Nginx (intention)

- **app** : `root` → `frontend/dist` ; `try_files $uri $uri/ /index.html` (SPA).
- **api** : `proxy_pass http://127.0.0.1:5000` + headers `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`.

### 8.5 Pièges déjà rencontrés en prod (à connaître)

1. Seed sans `SEED_ADMIN_*` → refus du script.
2. `MONGO_URI` sans credentials alors que Mongo a `authorization: enabled` → `Command find requires authentication`.
3. Lancer `mongod` manuellement en root sur `/var/lib/mongodb` → **Permission denied** au redémarrage systemd (corriger : `chown -R mongodb:mongodb /var/lib/mongodb`).
4. Front buildé sans `VITE_API_URL` prod → appels vers `localhost:5000`.
5. `FRONTEND_URL` incorrect → CORS bloque le login.

---

## 9. Infrastructure résumé

| Composant | Détail |
|-----------|--------|
| VPS | OVH, Ubuntu 24.04 |
| Node | LTS (ex. 22.x sur le serveur de déploiement) |
| Process manager | PM2 + `pm2 save` / `startup` |
| Web server | Nginx |
| DB | MongoDB 8.x (logs prod ont montré 8.0.x) |
| Ports publics | 22 (SSH), 80, 443 |
| Port Mongo | 27017 **localhost only** |
| Certificats | Let’s Encrypt pour `app` + `api` |

---

## 10. Conventions de code

- ESM (`"type": "module"`) partout backend/frontend.
- DTOs « public » dans `utils/*Public.js` (ne pas renvoyer `passwordHash`).
- Erreurs métier : `Error` + `err.statusCode` (400/403/409…) + `errorHandler`.
- Soft archive plutôt que delete immédiat.
- UI Tailwind utilitaire, layout sidebar slate ; pages métier en français.

---

## 11. Fichiers « point d’entrée » pour naviguer le code

| Besoin | Fichier |
|--------|---------|
| Routes HTTP | `backend/src/app.js` + `backend/src/routes/*` |
| Modèles | `backend/src/models/*` |
| Récurrence | `backend/src/utils/recurrenceSeances.js` + `formationsController.js` |
| Conflits salles | `backend/src/utils/seanceRoomOverlap.js` |
| Horaires | `backend/src/utils/seanceScheduleParis.js` |
| Stats ateliers | `backend/src/controllers/statsController.js` → `getWorkshopsStats` |
| Routes UI | `frontend/src/App.jsx` |
| Client HTTP | `frontend/src/lib/axios.js` |
| Inscriptions UI | `frontend/src/pages/SeanceDetail.jsx` |
| Archives UI | `frontend/src/pages/Historique.jsx` |
| Calendrier multi-agence | `frontend/src/pages/Calendrier.jsx` |

---

## 12. Ce qui n’existe pas (ou pas encore)

- Pas de dossier `docs/` historiquement rempli (ce brief le crée).
- Pas de tests automatisés unitaires/e2e dans le dépôt.
- Pas de SMTP / emails transactionnels dans le code actuel.
- La récurrence n’est **pas** stockée comme document ; seule la génération de séances compte.
- Pas d’API GraphQL — REST uniquement.

---

## 13. Checklist de sanity pour une IA avant une PR

- [ ] Local : backend health OK, login OK, CORS local OK.
- [ ] Création formation + récurrence → séances visibles calendrier (bonne agence).
- [ ] Deux séances même horaire, **deux salles** → OK ; **même salle** → 409.
- [ ] Inscription N prochaines séances fonctionne.
- [ ] Régénération récurrence confirme wipe séances/inscriptions.
- [ ] Archives : destroy seulement si archivé.
- [ ] Stats workshops avec `month` ou `from`/`to`.
- [ ] Feuille d’émargement s’ouvre / s’imprime.
- [ ] Aucun secret dans le commit ; `.env` inchangé côté git.

---

## 14. Phrase d’intention produit (résumé une ligne)

**Gestion Ariane V2** est l’outil interne d’Ariane Méditerranée pour planifier les ateliers (formations/séances/salles multi-sites), affecter les bénéficiaires via leurs référents, suivre les présences, produire des stats et des feuilles d’émargement, avec archivage contrôlé — déployé en prod sur VPS OVH derrière Nginx/HTTPS.
