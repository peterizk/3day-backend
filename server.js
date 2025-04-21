const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
const bodyParser = require('body-parser');
// Stripe requires the raw body for webhook signature verification
app.use(
  '/webhook',
  bodyParser.raw({ type: 'application/json' })
);

// Normal JSON parsing for everything else
app.use(express.json());
app.use(cors());

// Middleware
app.use(cors());
app.use(express.json());

// Connect to SQLite
const db = new sqlite3.Database('./intake.db', (err) => {
  if (err) console.error(err.message);
  else console.log('Connected to SQLite database.');
});

// Create tables if not exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT NOT NULL,
      message TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS campers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER,
      name TEXT,
      age INTEGER NOT NULL,
      phone TEXT,
      email TEXT NOT NULL,
      grade TEXT,
      FOREIGN KEY (submission_id) REFERENCES submissions(id)
    )
  `);
});

// POST /submit route
app.post('/submit', (req, res) => {

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/create-checkout-session', (req, res) => {
  const { camperCount } = req.body;

  if (!camperCount || camperCount < 1) {
    return res.status(400).json({ error: 'Invalid camper count' });
  }

  const lineItems = [];

  // 1st camper = $30
  if (camperCount >= 1) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Camper 1 Registration' },
        unit_amount: 3000, // cents
      },
      quantity: 1,
    });
  }

  // 2nd camper = $20
  if (camperCount >= 2) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Camper 2 Registration' },
        unit_amount: 2000,
      },
      quantity: 1,
    });
  }

  // Additional campers = $15
  if (camperCount > 2) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Additional Campers (3+)' },
        unit_amount: 1500,
      },
      quantity: camperCount - 2,
    });
  }

  stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    success_url: 'http://localhost:3000/success',
    cancel_url: 'http://localhost:3000/cancel',
  })
    .then(session => res.json({ url: session.url }))
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'Stripe checkout failed' });
    });
});


  const { name, email, message, campers } = req.body;
  if (!email || !campers || !campers.length) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  // Insert submission
  const insertSubmission = `INSERT INTO submissions (name, email, message) VALUES (?, ?, ?)`;
  db.run(insertSubmission, [name, email, message], function (err) {
    if (err) return res.status(500).json({ error: err.message });

    const submissionId = this.lastID;

    // Insert each camper
    const insertCamper = db.prepare(
      `INSERT INTO campers (submission_id, name, age, phone, email, grade) VALUES (?, ?, ?, ?, ?, ?)`
    );

    campers.forEach((camper) => {
      insertCamper.run(
        submissionId,
        camper.name,
        camper.age,
        camper.phone,
        camper.email,
        camper.grade
      );
    });

    insertCamper.finalize();
    res.json({ message: 'Form submitted and saved to database!' });
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
