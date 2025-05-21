async function submitData() {
  const studentId = document.getElementById("studentId").value.trim();
  const medCode = document.getElementById("medCode").value.trim();

  if (!studentId || !medCode) {
    alert("Both fields are required.");
    return;
  }

  const response = await fetch("/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, medCode }),
  });

  if (response.ok) {
    alert("Medication logged successfully!");
    document.getElementById("studentId").value = "";
    document.getElementById("medCode").value = "";
    document.getElementById("studentId").focus();
  } else {
    alert("Failed to log medication.");
  }
}