import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());
// Allow CORS so Captivate (different origin) can call your API
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Simple GET to confirm server is alive in a browser
app.get("/", (req, res) => {
  res.send("✅ Server is running!");
});

app.post('/api/ask', async (req, res) => {
  const userInput = req.body.input || "";
  const learnerName = req.body.name || "Manager";
  const employeeName = req.body.employee || "the employee";

  if (!userInput.trim()) {
    return res.json({
      response: `Hi ${learnerName},\n\nNo feedback detected.`
    });
  }

  const fullPrompt =
    `Hi ${learnerName}, please review your feedback for ${employeeName}. ` +
    `Below is the original feedback you provided:\n\n"${userInput}"\n\n` +
    `First, critique this feedback by briefly explaining if it is adequate or inadequate — be specific about why. ` +
    `Then, provide an improved version of the feedback that: \n` +
    `- Demonstrates specificity and focuses on behavior\n` +
    `- Includes actionable advice\n` +
    `- Uses the SBI model (Situation, Behavior, Impact)\n` +
    `- Applies the Feedback Sandwich approach\n` +
    `- Follows the 5:1 Rule where possible\n\n` +
    `Keep the tone supportive and constructive.`;

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a workplace feedback expert. Provide clear, constructive, and actionable feedback evaluations."
          },
          {
            role: "user",
            content: fullPrompt
          }
        ],
        temperature: 1.0,
        max_tokens: 500
      })
    });

    const data = await openaiResponse.json();

    if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      return res.json({
        response: `Hi ${learnerName},\n\n${data.choices[0].message.content.trim()}`
      });
    } else {
      return res.json({
        response: `Hi ${learnerName},\n\nError: Unexpected API response.`
      });
    }
  } catch (err) {
    return res.json({
      response: `Hi ${learnerName},\n\nError: ${err.message}`
    });
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});