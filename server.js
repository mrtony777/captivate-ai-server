// server.js
import express from "express";
import cors from "cors";

const app = express();

// --- CORS: allow your actual hosting origins ---
const ALLOWED = new Set([
  "https://tonydemos.s3.us-east-2.amazonaws.com",   // your Captivate course on S3
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

// --- health check ---
app.get("/health", (_, res) => res.json({ ok: true }));

// ========== 1) Existing AI Coach endpoint (your current file) ==========
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

// ========== 2) Add Feedback-for-Managers endpoint (/api/ask) ==========
app.post("/api/ask", async (req, res) => {
  try {
    const { input, name = "Manager", employee = "Employee" } = req.body || {};
    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "Missing input" });
    }

    // Simple persona prompt (Jordan/Alex/etc.)
    const system = `You are an assistant helping managers practice feedback conversations.
Tailor tone and examples to the named employee. Be concise, specific, and constructive.`;
    const user = `Manager name: ${name}
Employee: ${employee}
Manager's notes: """${input}"""
Produce a short, clear feedback message to ${employee} using SBI (Situation-Behavior-Impact) and one actionable next step.`;

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
        temperature: 0.6
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error || "API error" });

    const response = data?.choices?.[0]?.message?.content?.trim() || "";
    return res.json({ response });
  } catch (e) {
    console.error("ask error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server listening on ${PORT}`));
