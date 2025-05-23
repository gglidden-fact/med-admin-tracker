const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Create the logs table if it doesn't exist
pool.query(`
  CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    student_id TEXT,
    med_code TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error("DB Init Error (logs):", err));

// Create the pass_history table if it doesn't exist
pool.query(`
  CREATE TABLE IF NOT EXISTS pass_history (
    id SERIAL PRIMARY KEY,
    student_id TEXT,
    med_code TEXT,
    timestamp TIMESTAMP,
    nurse_name TEXT,
    shift_id TEXT,
    pass_submitted TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error("DB Init Error (pass_history):", err));

// POST: Log a medication event
app.post("/log", async (req, res) => {
  const { studentId, medCode } = req.body;
  if (!studentId || !medCode) {
    return res.status(400).json({ error: "Missing student ID or med code" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO logs (student_id, med_code) VALUES ($1, $2) RETURNING *",
      [studentId, medCode]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Fetch all logs
app.get("/logs", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM logs ORDER BY timestamp DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/complete-pass", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM logs ORDER BY timestamp ASC");
    const logs = result.rows;

    const nurse = req.query.nurse || "Unknown";
    const shift = req.query.shift || "Unspecified";

    // Archive the data before deleting
    const insertPromises = logs.map(entry => {
      return pool.query(
        `INSERT INTO pass_history (student_id, med_code, timestamp, nurse_name, shift_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [entry.student_id, entry.med_code, entry.timestamp, nurse, shift]
      );
    });

    await Promise.all(insertPromises);
    await pool.query("DELETE FROM logs");

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Fetch archived med passes
app.get("/history", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM pass_history ORDER BY pass_submitted DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve index.html at root URL
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Log the environment and start the server
console.log("RAILWAY PORT ENV:", process.env.PORT);
app.listen(port, () => {
  console.log("🚨 This is the real server.js from George's Mac");
  console.log(`Server running on port ${port}`);
});