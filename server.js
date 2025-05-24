const fs = require("fs");
const path = require("path");

// POST: Log a completed med pass for a student + block, and save to archive CSV
app.post("/log-block", async (req, res) => {
  const { student, block, staff, controls = [] } = req.body;

  if (!student || !block || !staff) {
    return res.status(400).json({ error: "Missing student, block, or staff name." });
  }

  const timestamp = new Date().toISOString();
  const med_code = `Block: ${block}`;
  const [control1 = "", control2 = "", control3 = ""] = controls;

  try {
    // Insert into PostgreSQL logs table
    const dbResult = await pool.query(
      `INSERT INTO logs (student_id, med_code) VALUES ($1, $2) RETURNING *`,
      [student, med_code]
    );

    // Prepare CSV line
    const csvRow = `"${student}","${block}","${staff}","${timestamp}","${control1}","${control2}","${control3}"\n`;

    // Ensure /archives folder exists
    const archiveDir = path.join(__dirname, "archives");
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir);
    }

    // Format file name as YYYY-MM-DD-AM.csv
    const date = new Date().toISOString().split("T")[0];
    const filename = `${date}-${block.toUpperCase()}.csv`;
    const filePath = path.join(archiveDir, filename);

    // Write header if file is new
    const header = `"Student","Block","Staff","Timestamp","Control1","Control2","Control3"\n`;
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, header + csvRow);
    } else {
      fs.appendFileSync(filePath, csvRow);
    }

    res.json({ status: "success", entry: dbResult.rows[0] });
  } catch (err) {
    console.error("Error logging med pass:", err);
    res.status(500).json({ error: "Failed to log med pass." });
  }
});