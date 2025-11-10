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
function personaFor(employeeRaw = "") {
  const e = String(employeeRaw).trim().toLowerCase();
  switch (e) {
    case "jordan":
      return "Jordan is collaborative and positive, but underestimates task time. Benefits from clearer planning, interim milestones, and proactive status updates.";
    case "alex":
      return "Alex is detail-oriented and delivers high quality work, but can get stuck polishing. Benefits from time-boxing and explicit priorities.";
    case "taylor":
      return "Taylor is strong with customers but context-switches often. Benefits from focused work blocks and crisp handoff notes.";
    case "rivera":
    case "alex rivera":
      return "Alex Rivera values autonomy and concise feedback. Responds well to concrete examples and measurable next steps.";
    default:
      return "";
  }
}

/* ------------------ Shared module Principles & Techniques ------------------ */
/** If the course doesn't pass moduleGuidelines, we inject these by default. */
const DEFAULT_MODULE_GUIDELINES = `
Principles of Effective Feedback:
- Specificity: Focus on clear, actionable details.
- Timeliness: Provide feedback promptly for relevance.
- Balance: Combine positive and constructive insights.
- Clarity: Communicate with simple, direct language.
- Focus on Behavior: Address actions, not personality.

Specific Feedback Techniques:
- SBI Model: Describe the Situation, Behavior, and Impact.
- Feedback Sandwich: Start positive, give constructive feedback, end on a positive note.
- 5:1 Rule: Offer five positive comments for every constructive one.
- Actionable Advice: Ensure feedback leads to specific, practical actions.
- Follow-up: Revisit feedback to track progress and adjust as needed.
`;

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

/* -------- 2) Feedback-for-Managers endpoint: Scenario-aware evaluation ------ */
app.post("/api/ask", async (req, res) => {
  try {
    const {
      input,
      name = "Manager",
      employee = "Employee",

      // Optional, but recommended from Captivate
      reviewType = "ad-hoc",           // "ad-hoc" | "mid-year" | "annual"
      scenarioId = "",
      competencies = [],               // ["Ownership","Collaboration","Quality"]
      moduleGuidelines = "",           // overrides defaults if provided
      frameworkPreference = "SBI"      // "SBI" | "SBI+SMART" | "feedforward" | "none"
    } = req.body || {};

    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "Missing input" });
    }

    const persona = personaFor(employee);
    const isReview = ["mid-year", "annual"].includes(String(reviewType).toLowerCase());

    // Rubrics differ for reviews vs. ad-hoc feedback
    const rubric = isReview
      ? `Rubric (score each 0–5 with a one-line justification):
- Goals & Results Alignment: References agreed goals/OKRs and concrete outcomes.
- Evidence & Specificity: Uses objective evidence (metrics/examples) and observable behaviors.
- Balance (Strengths + Gaps): Recognizes strengths and states gaps candidly without labels.
- Development Plan: Clear next steps, ownership, and a timebound follow-up.
- Fairness & Bias Awareness: Neutral, inclusive language; avoids assumptions.
${frameworkPreference.includes("SBI") ? "- SBI Structure (optional if naturally fits): Uses Situation–Behavior–Impact without forcing it.\n" : ""}`
      : `Rubric (score each 0–5 with a one-line justification):
- Clarity: Message is concise and easy to follow.
- Specificity & Evidence: References observable behaviors and concrete examples.
- Respectful, Bias-aware Tone: Neutral, supportive, and fair.
- Actionability: One clear next step with owner and timeframe.
- SBI Structure: ${frameworkPreference === "none" ? "Optional—use only if it improves clarity." : "Expected—use SBI effectively."}
`;

    // Framework guidance
    const frameworkText =
      frameworkPreference === "SBI+SMART"
        ? `Prefer SBI to frame the message, and ensure the action uses SMART criteria (specific, measurable, achievable, relevant, timebound).`
        : frameworkPreference === "feedforward"
        ? `Use a feedforward approach: briefly acknowledge the past for context, then focus primarily on specific future behaviors and supports.`
        : frameworkPreference === "none"
        ? `Do not force a specific framework; choose the structure that maximizes clarity and actionability.`
        : `Use SBI when it helps clarity, but don't force it if another structure is clearer.`;

    // Compose system prompt with your Principles & Techniques embedded
    const system = `
You are a feedback coach inside an e-learning module for managers.
Evaluate the manager's draft and then produce a corrected example of how to say it.
Always align to the following Principles and Techniques:

${moduleGuidelines?.trim() ? moduleGuidelines : DEFAULT_MODULE_GUIDELINES}
${persona ? "\nEmployee Persona: " + persona : ""}
Avoid labels and personality judgments—focus on observed behaviors and outcomes. Keep outputs concise and practical.`;

    // Compose user prompt
    const user = `
Context:
- Scenario ID: ${scenarioId || "(none provided)"}
- Review Type: ${reviewType}
- Framework Preference: ${frameworkPreference}
- Competencies Focus: ${competencies && competencies.length ? competencies.join(", ") : "(none provided)"}

Manager Name: ${name}
Employee: ${employee}

Manager's draft:
"""${input}"""

${rubric}
${frameworkText}

Return EXACTLY these sections:

1) Evaluation (score each item 0–5 with a one-line justification)
${isReview
  ? `- Goals & Results Alignment:
- Evidence & Specificity:
- Balance (Strengths + Gaps):
- Development Plan:
- Fairness & Bias Awareness:
${frameworkPreference.includes("SBI") ? "- SBI Structure (if used):\n" : ""}`
  : `- Clarity:
- Specificity & Evidence:
- Respectful, Bias-aware Tone:
- Actionability:
- SBI Structure:
`
}

Verdict: State **Good** if the draft already meets the rubric or **Needs Work** otherwise, followed by a 1–2 sentence rationale referencing "${reviewType}".

2) Improved Example (what the manager should say to ${employee})
- ${isReview ? "5–8 sentences" : "4–6 sentences"}, aligned to the rubric above.
- ${
  frameworkPreference === "SBI+SMART"
    ? "Use SBI to frame the context, and ensure the next step is a SMART commitment."
    : frameworkPreference === "feedforward"
    ? "Use a feedforward, future-focused coaching tone."
    : frameworkPreference === "none"
    ? "Use the clearest structure for this scenario; SBI is optional."
    : "Use SBI if it improves clarity; otherwise pick the clearest structure."
}
- Apply the **Principles** (Specificity, Timeliness, Balance, Clarity, Focus on Behavior) and **Techniques** (SBI/Feedback Sandwich/5:1 Rule/Actionable Advice/Follow-up) as appropriate to the scenario.
- Avoid jargon. Be specific, supportive, and direct.

3) Reflection Prompt
- 1 line only, customized to ${reviewType} and the competencies listed.`;

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
        temperature: isReview ? 0.4 : 0.5,
        max_tokens: 900
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
