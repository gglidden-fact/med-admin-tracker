const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
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

// Ensure logs table exists
pool.query(`
  CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    student_id TEXT,
    med_code TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error("DB Init Error:", err));

// ✅ Auto-create PRN columns if missing
(async () => {
  try {
    await pool.query(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS prn_reason TEXT`);
    await pool.query(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS prn_effect TEXT`);
    console.log("✅ PRN columns verified or created.");
  } catch (err) {
    console.error("❌ Failed to create PRN columns:", err.message);
  }
})();

// POST: Log med pass
app.post("/log-block", async (req, res) => {
  const {
    student,
    block,
    staff,
    controls = [],
    prnReason = "",
    prnEffect = ""
  } = req.body;

  if (!student || !block || !staff) {
    return res.status(400).json({ error: "Missing student, block, or staff." });
  }

  const timestamp = new Date();
  const med_code = `Block: ${block}`;
  const [control1 = "", control2 = "", control3 = ""] = controls;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const exists = await pool.query(
      `SELECT 1 FROM logs 
       WHERE student_id = $1 
         AND med_code = $2 
         AND timestamp >= $3`,
      [student, med_code, today.toISOString()]
    );

    if (exists.rows.length > 0) {
      return res.status(409).json({ error: "Med pass already logged today for this block." });
    }

    const dbResult = await pool.query(
      `INSERT INTO logs (student_id, med_code, prn_reason, prn_effect) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [student, med_code, prnReason, prnEffect]
    );

    // Archive to CSV
    const csvRow = `"${student}","${block}","${staff}","${timestamp.toISOString()}","${control1}","${control2}","${control3}","${prnReason}","${prnEffect}"\n`;
    const archiveDir = path.join(__dirname, "archives");
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir);

    const dateStr = timestamp.toISOString().split("T")[0];
    const filename = `${dateStr}-${block.toUpperCase()}.csv`;
    const filePath = path.join(archiveDir, filename);

    const header = `"Student","Block","Staff","Timestamp","Control1","Control2","Control3","PRN_Reason","PRN_Effect"\n`;
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, header + csvRow);
    } else {
      fs.appendFileSync(filePath, csvRow);
    }

    // Subtract controls
    for (const med of [control1, control2, control3]) {
      if (med) {
        await pool.query(
          `UPDATE control_counts
           SET count = GREATEST(count - 1, 0)
           WHERE student_id = $1 AND medication = $2`,
          [student, med]
        );
      }
    }

    res.json({ status: "success", entry: dbResult.rows[0] });
  } catch (err) {
    console.error("Error in /log-block:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// GET: Daily schedule + status
app.get("/schedule/today", async (req, res) => {
  try {
    const schedule = require("./data/todays-schedule.json");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logs = await pool.query(
      `SELECT student_id, med_code FROM logs WHERE timestamp >= $1`,
      [today.toISOString()]
    );

    const givenSet = new Set(
      logs.rows.map(row => `${row.student_id}|${row.med_code}`)
    );

    const result = schedule.map(entry => {
      const key = `${entry.student}|Block: ${entry.block}`;
      return { ...entry, given: givenSet.has(key) };
    });

    res.json(result);
  } catch (err) {
    console.error("Error in /schedule/today:", err);
    res.status(500).json({ error: "Unable to load schedule." });
  }
});

// Start server
console.log("RAILWAY PORT ENV:", process.env.PORT);
app.get("/logs", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM logs ORDER BY timestamp DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.listen(port, () => {
  console.log(`🚨 Server running on port ${port}`);
});