const fs = require("fs");
const path = require("path");

// POST: Log a completed med pass (with duplicate protection)
app.post("/log-block", async (req, res) => {
  const { student, block, staff, controls = [] } = req.body;

  if (!student || !block || !staff) {
    return res.status(400).json({ error: "Missing student, block, or staff name." });
  }

  const timestamp = new Date();
  const med_code = `Block: ${block}`;
  const [control1 = "", control2 = "", control3 = ""] = controls;

  try {
    // Check if already logged today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const check = await pool.query(
      `SELECT * FROM logs 
       WHERE student_id = $1 
         AND med_code = $2 
         AND timestamp >= $3`,
      [student, med_code, todayStart.toISOString()]
    );

    if (check.rows.length > 0) {
      return res.status(409).json({ error: "Med pass already recorded for this block." });
    }

    // Save to DB
    const dbResult = await pool.query(
      `INSERT INTO logs (student_id, med_code) VALUES ($1, $2) RETURNING *`,
      [student, med_code]
    );

    // Save to CSV
    const csvRow = `"${student}","${block}","${staff}","${timestamp.toISOString()}","${control1}","${control2}","${control3}"\n`;

    const archiveDir = path.join(__dirname, "archives");
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir);
    }

    const dateStr = timestamp.toISOString().split("T")[0]; // YYYY-MM-DD
    const filename = `${dateStr}-${block.toUpperCase()}.csv`;
    const filePath = path.join(archiveDir, filename);

    const header = `"Student","Block","Staff","Timestamp","Control1","Control2","Control3"\n`;
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, header + csvRow);
    } else {
      fs.appendFileSync(filePath, csvRow);
    }

    res.json({ status: "success", entry: dbResult.rows[0] });
  } catch (err) {
    console.error("Error in /log-block:", err);
    res.status(500).json({ error: "Server error while logging med pass." });
  }
});