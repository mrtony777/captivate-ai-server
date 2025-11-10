// server.js
import express from "express";
import cors from "cors";

const app = express();

/* ------------------------- CORS: allowed front-ends ------------------------- */
const ALLOWED = new Set([
  "https://tonydemos.s3.us-east-2.amazonaws.com",   // Captivate course on S3
  "https://portfolio.visiomediatech.com",
  "https://tonymosby360photography.com",
  "https://www.tonymosby360photography.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:8080"
]);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED.has(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

/* --------------------------------- Health ---------------------------------- */
app.get("/health", (_, res) => res.json({ ok: true }));

/* --------------------------- Helper: Personas ------------------------------- */
/** Returns a short persona string for the given employee name */
function personaFor(employeeRaw = "") {
  const e = String(employeeRaw).trim().toLowerCase();
  switch (e) {
    case "jordan":
      return "Jordan is collaborative and positive, but underestimates task time. Benefits from clearer planning and milestone check-ins.";
    case "alex":
      return "Alex is detail-oriented and produces high quality work, but can get stuck polishing. Benefits from time-boxing and clear priorities.";
    case "taylor":
      return "Taylor is strong with customers but context switches often. Benefits from focused work blocks and explicit handoff notes.";
    case "rivera":
    case "alex rivera":
      return "Alex Rivera values autonomy and concise feedback. Responds well to concrete examples and measurable next steps.";
    default:
      return ""; // unknown employee—no extra biasing
  }
}

/* --------------------------- 1) AI Coach endpoint --------------------------- */
app.post("/api/coach", async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    const data = await r.json();
    return res.status(r.ok ? 200 : r.status).json(data);
  } catch (e) {
    console.error("coach error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* -------- 2) Feedback-for-Managers endpoint: Evaluation + Example --------- */
app.post("/api/ask", async (req, res) => {
  try {
    const { input, name = "Manager", employee = "Employee" } = req.body || {};
    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "Missing input" });
    }

    // Optional persona tweak based on employee
    const persona = personaFor(employee);

    const system = `
You are a feedback coach for managers practicing performance conversations in an e-learning module.
Evaluate the manager's draft and then produce a corrected example of how to say it.
Follow best practices: SBI (Situation–Behavior–Impact), 1 clear next step, respectful tone,
specific/observable behavior (not traits), bias-aware wording, and concise phrasing.${
      persona ? `\nPersona: ${persona}` : ""
    }`;

    const user = `
Manager Name: ${name}
Employee: ${employee}
Manager's draft feedback:
"""${input}"""

Return EXACTLY these sections:

1) Evaluation (Score each 0–5 with a one-line justification per item)
- Clarity:
- Uses SBI (Situation–Behavior–Impact):
- Specific, observable behavior:
- Respectful, bias-aware tone:
- Actionable next step:

1–2 sentence overall verdict.

2) Improved Example (what the manager should say to ${employee})
- 4–6 sentences total using SBI and one clear next step.
- Supportive, direct, and specific. Avoid jargon.

3) Reflection Prompt
- 1 line only.`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.5,
        max_tokens: 600
      })
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error || "API error" });
    }

    const response = (data?.choices?.[0]?.message?.content || "").trim();
    return res.json({ response });
  } catch (e) {
    console.error("ask error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* --------------------------------- Boot ------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server listening on ${PORT}`));
