const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const SEED = path.join(__dirname, 'seed.json');
const DATA = path.join(__dirname, 'data.json');
if (!fs.existsSync(DATA)) fs.copyFileSync(SEED, DATA);

const load = () => JSON.parse(fs.readFileSync(DATA, 'utf8'));
const save = (db) => fs.writeFileSync(DATA, JSON.stringify(db, null, 2));

app.get('/health', (req, res) => res.json({ status: 'ok', hospital: 'Hospital A' }));

// All patients (basic info)
app.get('/patients', (req, res) => res.json(load().patients));

// One patient with full history, looked up by barcode
app.get('/patients/:barcode', (req, res) => {
  const db = load();
  const p = db.patients.find(x => x.barcode === req.params.barcode);
  if (!p) return res.status(404).json({ error: 'Patient not found' });
  const own = list => list.filter(x => x.barcode === p.barcode);
  res.json({ ...p, visits: own(db.visits), labs: own(db.labs), prescriptions: own(db.prescriptions) });
});

// Admin: add a new visit (for the live demo)
app.post('/admin/visits', (req, res) => {
  const db = load();
  const { barcode, department, doctor, diagnosis, labs = [], prescriptions = [] } = req.body;
  if (!db.patients.some(p => p.barcode === barcode)) return res.status(404).json({ error: 'Unknown barcode' });

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const date = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const visitId = `V-${Date.now()}`;

  db.visits.push({ visitId, barcode, date, department, doctor, diagnosis });
  labs.forEach((l, i) => db.labs.push({ labId: `L-${Date.now()}-${i}`, barcode, visitId, takenAt: `${date} 09:00`, ...l }));
  prescriptions.forEach((r, i) => db.prescriptions.push({ rxId: `RX-${Date.now()}-${i}`, barcode, visitId, ...r }));
  save(db);
  res.status(201).json({ visitId });
});

// Admin: reset to seed data
app.post('/admin/reset', (req, res) => { fs.copyFileSync(SEED, DATA); res.json({ reset: true }); });

app.listen(8081, () => console.log('Hospital A running on http://localhost:8081'));