# StudyPlan — Implementation Log

Questo file documenta passo per passo cosa è stato implementato, come, e perché.
Serve da riferimento per l'esame reale: leggilo prima di iniziare a scrivere codice.

---

## Ordine di implementazione consigliato

1. **Database** ✓
2. **Data Models (DAO)** ✓
3. **Server: GET routes + middleware base** ✓
4. **Server: POST/DELETE sessioni + PUT/DELETE study plan** ✓
5. **Client: routing React + layout base**
6. **Client: lista corsi (pagina pubblica)**
7. **Client: login/logout**
8. **Client: piano di studi (visualizzazione + editing)**
5. **Client: routing React + layout base**
6. **Client: lista corsi (pagina pubblica)**
7. **Client: login/logout**
8. **Client: piano di studi (visualizzazione + editing)**

---

## Step 1 — Database

### Decisioni di schema

#### Tabella `courses`
```sql
CREATE TABLE courses (
  courseCode        TEXT    PRIMARY KEY,
  name              TEXT    NOT NULL,
  credits           INTEGER NOT NULL,
  maxStudents       INTEGER,                           -- NULL = nessun limite
  preparatoryCourse TEXT REFERENCES courses(courseCode) -- NULL = nessun prerequisito
);
```
**Perché `preparatoryCourse` è una colonna di `courses` e non una tabella separata?**
La spec dice che ogni corso ha *al più uno* prerequisito. Una FK self-referenziale è sufficiente e più semplice.

**Perché NON memorizzo `enrolledCount`?**
Calcolato dinamicamente con `COUNT(*)` su `study_plan_courses`. Memorizzarlo come colonna creerebbe duplicazione e rischio di inconsistenza ogni volta che il piano viene salvato/cancellato.

---

#### Tabella `incompatibilities`
```sql
CREATE TABLE incompatibilities (
  courseCode1 TEXT NOT NULL REFERENCES courses(courseCode),
  courseCode2 TEXT NOT NULL REFERENCES courses(courseCode),
  PRIMARY KEY (courseCode1, courseCode2)
);
```
**Perché entrambe le direzioni (A→B e B→A)?**
Le incompatibilità sono simmetriche. Storandole in entrambe le direzioni, le query diventano più semplici: `WHERE courseCode1 = ?` invece di `WHERE courseCode1 = ? OR courseCode2 = ?`. Costo: 2× le righe (18 righe per 9 coppie), trascurabile.

---

#### Tabella `users`
```sql
CREATE TABLE users (
  userId         INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  surname        TEXT    NOT NULL,
  email          TEXT    UNIQUE NOT NULL,
  hashedPassword TEXT    NOT NULL,   -- hash scrypt (hex)
  salt           TEXT    NOT NULL,   -- salt casuale (hex)
  planType       TEXT    CHECK(planType IN ('full-time', 'part-time'))  -- NULL = nessun piano
);
```
**Hashing password**: `crypto.scryptSync(password, salt, 32).toString('hex')`.
Salt generato con `crypto.randomBytes(16)`. Pattern standard del corso WAI.

**Perché `planType` è in `users` e non in tabella separata?**
Ogni studente ha al più un piano. Mettere `planType` direttamente in `users` evita una JOIN per sapere se l'utente ha un piano e di che tipo. `planType = NULL` significa nessun piano attivo.

**Crediti per tipo:**
- `full-time`: 60–80 crediti
- `part-time`: 20–40 crediti

---

#### Tabella `study_plan_courses`
```sql
CREATE TABLE study_plan_courses (
  userId     INTEGER NOT NULL REFERENCES users(userId),
  courseCode TEXT    NOT NULL REFERENCES courses(courseCode),
  PRIMARY KEY (userId, courseCode)
);
```
Tabella pivot N:N tra studenti e corsi del loro piano. PK composta impedisce duplicati.

---

### Dati di test (init_db.mjs)

| Email | Password | Tipo | Crediti |
|---|---|---|---|
| mario.rossi@polito.it | password | full-time | 62 |
| luigi.verdi@polito.it | password | full-time | 63 |
| anna.bianchi@polito.it | password | full-time | 61 |
| carla.neri@polito.it | password | part-time | 32 |
| franco.gialli@polito.it | password | part-time | 29 |

**Corsi a capienza massima:**
- `01OTWOV` (max 3): iscritti user1, user2, user3 → **3/3**
- `01URSPD` (max 2): iscritti user1, user2 → **2/2**

**Come rigenerare il DB:**
```bash
cd server
node init_db.mjs
```
Attenzione: ricrea tutto da zero, perdendo dati esistenti.

---

### Struttura file server

```
server/
  db.mjs          ← apre la connessione SQLite, abilita FK, esporta `db`
  init_db.mjs     ← script one-shot per creare e popolare il DB
  index.mjs       ← entry point Express (da avviare con nodemon)
  studyplan.db    ← file SQLite generato da init_db.mjs
  package.json
```

**Dipendenze aggiunte a `package.json`:**
- `better-sqlite3`: driver SQLite sincrono, più semplice da usare con Express
- `cors`: per la configurazione "two servers" (client porta 5173, server porta 3001)
- `express-session`: gestione sessioni con cookie
- `passport` + `passport-local`: autenticazione username/password

---

### Pattern da ricordare

**Apertura DB (db.mjs):**
```javascript
import Database from 'better-sqlite3';
const db = new Database('studyplan.db');
db.pragma('foreign_keys = ON');  // OBBLIGATORIO: SQLite disabilita FK di default
export default db;
```

**Query tipiche nelle API:**
```javascript
// Lista corsi con conteggio iscritti
db.prepare(`
  SELECT c.*, COUNT(spc.userId) as enrolledCount
  FROM courses c
  LEFT JOIN study_plan_courses spc ON spc.courseCode = c.courseCode
  GROUP BY c.courseCode
  ORDER BY c.name
`).all();

// Incompatibilità di un corso
db.prepare(`
  SELECT courseCode2 FROM incompatibilities WHERE courseCode1 = ?
`).all(courseCode);

// Piano di studi di un utente
db.prepare(`
  SELECT c.* FROM study_plan_courses spc
  JOIN courses c ON c.courseCode = spc.courseCode
  WHERE spc.userId = ?
`).all(userId);
```

**Verifica password al login (per Passport):**
```javascript
import crypto from 'crypto';
const { password: storedHash, salt } = userFromDb;
const hash = crypto.scryptSync(inputPassword, salt, 32).toString('hex');
const valid = crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(hash, 'hex'));
```

---

## Step 2 — Data Models (DAO)

Due file DAO separati per responsabilità: `dao-users.mjs` gestisce autenticazione, `dao-courses.mjs` gestisce corsi e piano di studi.

### dao-users.mjs

```javascript
getUser(email, password)   // verifica credenziali → user object o false
getUserById(id)            // ricostruisce user da sessione (usato da Passport)
```

**Pattern verifica password:**
```javascript
const hash = crypto.scryptSync(password, user.salt, 32).toString('hex');
crypto.timingSafeEqual(Buffer.from(user.hashedPassword, 'hex'), Buffer.from(hash, 'hex'));
```
`timingSafeEqual` obbligatorio — evita timing attacks.

**Cosa NON restituire mai:** `hashedPassword`, `salt`. Filtrati prima di restituire l'oggetto utente.

---

### dao-courses.mjs

```javascript
getCourses()                                    // tutti i corsi con enrolledCount + incompatibilities[]
getStudyPlan(userId)                            // corsi nel piano dell'utente
saveStudyPlan(userId, planType, courseCodes)    // atomic: cancella vecchio + inserisce nuovo + aggiorna planType
deleteStudyPlan(userId)                         // cancella corsi + setta planType = NULL
```

**Perché `saveStudyPlan` e `deleteStudyPlan` usano `db.transaction()`?**
Devono modificare due tabelle (`study_plan_courses` e `users.planType`) in modo atomico. Se una delle operazioni fallisce, entrambe vengono annullate. Con `better-sqlite3`, `db.transaction(fn)` restituisce una funzione wrappata — si chiama direttamente: `saveStudyPlan(userId, type, codes)`.

**Perché `planType` viene aggiornato in `dao-courses` e non in `dao-users`?**
`planType` è sempre modificato in coppia con `study_plan_courses` — separarli in due DAO richiederebbe chiamate multiple non atomiche. Accoppiare l'update in `dao-courses` mantiene l'atomicità e la coerenza.

**`enrolledCount` calcolato con LEFT JOIN + COUNT:**
```sql
SELECT c.*, COUNT(spc.userId) AS enrolledCount
FROM courses c
LEFT JOIN study_plan_courses spc ON spc.courseCode = c.courseCode
GROUP BY c.courseCode
ORDER BY c.name
```
`LEFT JOIN` necessario: corsi senza iscritti devono apparire con `enrolledCount = 0`, non essere esclusi.

---

### Struttura file aggiornata

```
server/
  db.mjs              ← connessione SQLite
  dao-users.mjs       ← autenticazione utenti
  dao-courses.mjs     ← corsi + piano di studi
  init_db.mjs         ← script inizializzazione DB
  index.mjs           ← entry point Express
  studyplan.db
  package.json
```

## Step 3 — GET routes + middleware base

### Middleware setup (index.mjs)

Ordine obbligatorio — cambiarlo rompe l'autenticazione:

1. `express.json()` — parsa body JSON
2. `cors({ origin, credentials: true })` — abilita cross-origin con cookie
3. `session({ secret, resave: false, saveUninitialized: false })` — sessioni
4. `passport.initialize()` + `passport.session()` — Passport legge la sessione

**Perché il Passport setup sta in index.mjs anche se le POST non ci sono ancora?**
`passport.session()` viene eseguito su *ogni* richiesta per deserializzare l'utente dalla sessione. Senza di esso, `req.user` è undefined anche sulle GET protette. Va configurato prima delle route.

---

### Passport LocalStrategy

```javascript
passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
  const user = getUser(email, password);  // dao-users.mjs
  if (!user) return done(null, false, { message: 'Invalid credentials.' });
  return done(null, user);
}));
```
`usernameField: 'email'` — override del default `'username'` per matchare il nostro schema.

```javascript
passport.serializeUser((user, done) => done(null, user.userId));
passport.deserializeUser((id, done) => {
  const user = getUserById(id);  // dao-users.mjs
  if (!user) return done(null, false);
  return done(null, user);
});
```
`serializeUser` salva solo `userId` nel cookie. `deserializeUser` ricarica l'utente dal DB ad ogni richiesta — così `req.user` è sempre aggiornato (incluso `planType` dopo save/delete).

---

### isLoggedIn middleware

```javascript
const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Not authenticated' });
};
```
Riusabile su qualsiasi route protetta: `app.get('/api/something', isLoggedIn, handler)`.

---

### GET /api/sessions/current

Non usa `isLoggedIn` — deve rispondere 401 senza bloccare, non redirigere. Il client lo chiama all'avvio per sapere se esiste una sessione attiva.

### GET /api/courses

Pubblica. Nessun middleware di autenticazione. Chiama `getCourses()` che restituisce già `enrolledCount` e `incompatibilities[]`.

### GET /api/studyplan

Protetta con `isLoggedIn`. Controlla `req.user.planType` — se NULL restituisce 404 (nessun piano). Altrimenti chiama `getStudyPlan(req.user.userId)` e restituisce `{ type, courses[] }`.

**Perché `planType` viene da `req.user` e non dal DB?**
`deserializeUser` ricarica l'utente dal DB ad ogni richiesta, quindi `req.user.planType` è già aggiornato — evita una query extra.

---

## Step 4 — POST/DELETE sessioni + PUT/DELETE study plan

### POST /api/sessions (login)

```javascript
app.post('/api/sessions', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || 'Invalid credentials' });
    req.login(user, (err) => {
      if (err) return next(err);
      res.json(req.user);  // req.user aggiornato da deserializeUser
    });
  })(req, res, next);
});
```

**Perché `passport.authenticate` come callback e non come middleware diretto?**
La forma `app.post('/api/sessions', passport.authenticate('local'))` non permette di personalizzare la risposta in caso di errore. La forma callback consente di restituire JSON invece di redirect (comportamento default di Passport).

**Perché `res.json(req.user)` e non `res.json(user)`?**
`req.login()` chiama `deserializeUser` che ricarica l'utente dal DB. `req.user` riflette sempre lo stato DB aggiornato.

---

### DELETE /api/sessions/current (logout)

```javascript
app.delete('/api/sessions/current', isLoggedIn, (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.status(200).json({});
  });
});
```

**Passport 0.6+ richiede callback su `req.logout()`** — senza callback, l'operazione è fire-and-forget e gli errori vengono ignorati.

---

### PUT /api/studyplan (crea o rimpiazza piano)

Validazioni eseguite in ordine prima di persistere:

1. `type` deve essere `'full-time'` o `'part-time'`
2. `courseCodes` deve essere un array
3. Tutti i codici devono esistere nel DB
4. Totale crediti nel range: full-time 60-80, part-time 20-40
5. Nessuna coppia incompatibile nel piano
6. Ogni corso con `preparatoryCourse` deve avere il prerequisito nel piano
7. Corsi con `maxStudents`: controllato solo per corsi **nuovi** rispetto al piano corrente — chi aveva gia il corso nel piano puo mantenerlo anche se ora e a capienza massima

**Perché validare server-side anche se il client lo fa gia?**
Il client puo essere bypassato. La validazione server e l'unica autoritativa.

**Operazione atomica**: `saveStudyPlan` usa `db.transaction()` — se un insert fallisce, nessuna modifica viene applicata.

---

### DELETE /api/studyplan

Chiama `deleteStudyPlan(userId)` — rimuove righe da `study_plan_courses` e setta `planType = NULL` in `users`, tutto in una transazione.

---

## Step 5 — Client React (TODO)

_(verrà documentato nel passo successivo)_

---

## Regole fondamentali

**1. Implementare SOLO quello che la traccia richiede esplicitamente.** Nessuna feature extra, nessuna astrazione non richiesta, nessun "miglioramento" non specificato. Se la traccia non lo dice, non si fa. L'esame valuta correttezza e aderenza ai requisiti, non creatività.

**2. Usare esclusivamente estensione `.js`.** Con `"type": "module"` in `package.json`, i file `.js` sono già trattati come ESM — `.mjs` non serve. Tutti i file server usano `.js`, tutti gli import usano `'./nome.js'`. Il comando di avvio è `nodemon index.js`.

---

## Note generali sull'architettura

- **Pattern "two servers"**: client su `:5173` (Vite), server su `:3001` (Express). Il server deve configurare CORS con `credentials: true` e `origin: 'http://localhost:5173'`.
- **Sessioni**: Express-session + Passport serializzano `user.id` nella sessione. Il cookie di sessione è l'unico meccanismo di autenticazione.
- **SPA**: React Router gestisce il routing lato client. Il server non conosce le route React.
- **Strict Mode**: React gira in StrictMode (default con Vite), che chiama gli effect due volte in dev. Non è un bug.
- **Validazione**: doppia — lato server (Express, obbligatoria) e lato client (React, per UX).
