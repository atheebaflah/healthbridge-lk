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

app.get('/health', (req, res) => res.json({ status: 'ok', hospital: 'Hospital B' }));

// Different style on purpose: versioned paths and a wrapped list
app.get('/api/v1/patients', (req, res) => {
  const items = load().patients;
  res.json({ count: items.length, items });
});

app.get('/api/v1/patients/:mrn', (req, res) => {
  const p = load().patients.find(x => x.mrn === req.params.mrn);
  p ? res.json(p) : res.status(404).json({ error: 'Not found' });
});

app.get('/api/v1/patients/:mrn/encounters', (req, res) =>
  res.json(load().encounters.filter(e => e.mrn === req.params.mrn)));

app.get('/api/v1/patients/:mrn/medications', (req, res) =>
  res.json(load().medications.filter(m => m.mrn === req.params.mrn)));

// Lab results only as a CSV export (all, or one patient with ?mrn=)
app.get('/exports/labs.csv', (req, res) => {
  const rows = load().labResults.filter(l => !req.query.mrn || l.mrn === req.query.mrn);
  const csv = ['mrn,test,result,units,date', ...rows.map(l => `${l.mrn},${l.test},${l.result},${l.units},${l.date}`)].join('\n');
  res.type('text/csv').send(csv);
});

// Admin: add an encounter with optional labs and medications (for the demo)
app.post('/admin/encounters', (req, res) => {
  const db = load();
  const { mrn, unit, consultant, primaryDiagnosis, labs = [], medications = [] } = req.body;
  if (!db.patients.some(p => p.mrn === mrn)) return res.status(404).json({ error: 'Unknown MRN' });

  const encounterNo = `E-${Date.now()}`;
  const startedAt = new Date().toISOString();
  db.encounters.push({ encounterNo, mrn, startedAt, unit, consultant, primaryDiagnosis });
  labs.forEach(l => db.labResults.push({ mrn, date: startedAt.slice(0, 10), ...l }));
  medications.forEach((m, i) => db.medications.push({ orderId: `M-${Date.now()}-${i}`, mrn, encounterNo, ...m }));
  save(db);
  res.status(201).json({ encounterNo });
});

app.post('/admin/reset', (req, res) => { fs.copyFileSync(SEED, DATA); res.json({ reset: true }); });

app.listen(8082, () => console.log('Hospital B running on http://localhost:8082'));