const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const app = express();
const db = new sqlite3.Database("./medadmin.db");

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

db.run(`CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT,
  med_code TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

app.post("/log", (req, res) => {
  const { studentId, medCode } = req.body;
  if (!studentId || !medCode) {
    return res.status(400).json({ error: "Missing data" });
  }
  db.run(
    "INSERT INTO logs (student_id, med_code) VALUES (?, ?)",
    [studentId, medCode],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, studentId, medCode, timestamp: new Date() });
    }
  );
});

app.get("/logs", (req, res) => {
  db.all("SELECT * FROM logs", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));