const fs = require("fs");
const path = require("path");

// POST: Log a med pass, prevent duplicates, and save CSV
app.post("/log-block", async (req, res) => {
  const { student, block, staff, controls = [] } = req.body;

  if (!student || !block || !staff) {
    return res.status(400).json({ error: "Missing student, block, or staff." });
  }

  const timestamp = new Date();
  const med_code = `Block: ${block}`;
  const [control1 = "", control2 = "", control3 = ""] = controls;

  try {
    // Check for duplicate for today
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

    // Log to database
    const dbResult = await pool.query(
      `INSERT INTO logs (student_id, med_code) VALUES ($1, $2) RETURNING *`,
      [student, med_code]
    );

    // Prepare CSV
    const row = `"${student}","${block}","${staff}","${timestamp.toISOString()}","${control1}","${control2}","${control3}"\n`;
    const archiveDir = path.join(__dirname, "archives");
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir);

    const dateStr = timestamp.toISOString().split("T")[0];
    const filename = `${dateStr}-${block.toUpperCase()}.csv`;
    const filePath = path.join(archiveDir, filename);

    const header = `"Student","Block","Staff","Timestamp","Control1","Control2","Control3"\n`;
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, header + row);
    } else {
      fs.appendFileSync(filePath, row);
    }

    res.json({ status: "success", entry: dbResult.rows[0] });
  } catch (err) {
    console.error("Error logging med pass:", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
});