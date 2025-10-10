import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

// ✅ Allowed front-end domains
const ALLOWED = new Set([
  "https://portfolio.visiomediatech.com",   // your portfolio site
  "http://localhost:3000",                  // local testing
  "http://127.0.0.1:5500"                   // optional local setup
]);

// ✅ CORS setup
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED.has(origin)) return cb(null, true);
    cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// ✅ Health check (for quick testing)
app.get("/health", (_, res) => res.json({ ok: true }));

// ✅ AI Route
app.post("/api/coach", async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) {
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
    res.status(r.ok ? 200 : r.status).json(data);

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
