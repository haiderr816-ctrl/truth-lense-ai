/* ============================================================
   TRUTH LENS — script.js
   Powered by: OpenRouter API (browser-safe, works everywhere)
   Sign up free at: https://openrouter.ai
   ============================================================ */


// ── STEP 1: PASTE YOUR OPENROUTER KEY HERE ───────────────────
//   Go to openrouter.ai → Keys → Create Key → paste it below

const API_KEY = "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";  // ← only change this line


// ── STEP 2: API SETTINGS (do not change these) ───────────────

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL   = "openrouter/free";  // Best choice: auto-picks any available free model";  // 100% free model


// ── STEP 3: GRAB HTML ELEMENTS ───────────────────────────────
//   These IDs must match your index.html exactly.

const analyzeBtn    = document.getElementById("analyze-btn");
const headlineInput = document.getElementById("headline-input");
const resultSection = document.getElementById("result-section");
const aiResponse    = document.getElementById("ai-response");


// ── STEP 4: SAFETY CHECK ─────────────────────────────────────

if (!analyzeBtn || !headlineInput || !resultSection || !aiResponse) {
  console.error(
    "❌ Missing HTML element! Check these IDs exist in index.html:\n" +
    "analyze-btn, headline-input, result-section, ai-response"
  );
}


// ── STEP 5: BUILD THE PROMPT ─────────────────────────────────

function buildPrompt(headline) {
  return `You are an expert fact-checker and media bias analyst.
Analyze the news headline below. Reply with ONLY a raw JSON object.
No markdown. No explanation. No code fences. Just the JSON.

{
  "rating": "one of: TRUE | MOSTLY TRUE | MIXED | MOSTLY FALSE | FALSE | UNVERIFIABLE",
  "confidence": "a percentage like 82%",
  "bias": "one sentence about political or emotional framing",
  "redFlags": ["flag one", "flag two"],
  "verdict": "two sentences summarizing your conclusion",
  "tip": "one tip for the reader to verify this themselves"
}

Headline: "${headline}"`;
}


// ── STEP 6: BUTTON CLICK → CALL THE API ─────────────────────

analyzeBtn.addEventListener("click", async () => {

  const headline = headlineInput.value.trim();

  if (!headline) {
    showError("Please type a headline first.", "📝");
    return;
  }

  // Show loading animation
  resultSection.style.display = "block";
  aiResponse.innerHTML = buildLoadingHTML();
  analyzeBtn.disabled = true;
  analyzeBtn.querySelector(".btn-text").textContent = "Analyzing…";

  try {

    // ── FETCH: Call OpenRouter ─────────────────────────────
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "HTTP-Referer":  window.location.href,
        "X-Title":       "Truth Lens"
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 600,
        messages: [
          {
            role:    "user",
            content: buildPrompt(headline)
          }
        ]
      })
    });

    // ── CHECK: Did the request succeed? ───────────────────
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        errData?.error?.message || `HTTP Error ${response.status}`
      );
    }

    const data = await response.json();
    console.log("✅ OpenRouter response:", data); // View in F12 Console

    // ── EXTRACT: Get the text from the response ────────────
    //   OpenRouter uses OpenAI format:
    //   data.choices[0].message.content
    const rawText = data.choices?.[0]?.message?.content;

    if (!rawText) {
      throw new Error("AI returned an empty response. Please try again.");
    }

    // ── PARSE + RENDER ─────────────────────────────────────
    const analysis = parseJSON(rawText);
    renderResult(headline, analysis);

  } catch (err) {
    console.error("❌ Error:", err);
    showError(err.message, "⚠️");

  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.querySelector(".btn-text").textContent = "Analyze Truth";
  }

});


// ── STEP 7: PARSE JSON FROM AI ───────────────────────────────

function parseJSON(text) {
  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      rating:     "UNVERIFIABLE",
      confidence: "N/A",
      bias:       "Could not parse structured response.",
      redFlags:   [],
      verdict:    text,
      tip:        "Try rephrasing your headline."
    };
  }
}


// ── STEP 8: RENDER THE RESULT CARD ───────────────────────────

function renderResult(headline, a) {

  const ratingStyles = {
    "TRUE":          { color: "#7ee8a2", label: "✅ TRUE" },
    "MOSTLY TRUE":   { color: "#a3e635", label: "☑️ MOSTLY TRUE" },
    "MIXED":         { color: "#fbbf24", label: "⚖️ MIXED" },
    "MOSTLY FALSE":  { color: "#fb923c", label: "⚠️ MOSTLY FALSE" },
    "FALSE":         { color: "#f87171", label: "❌ FALSE" },
    "UNVERIFIABLE":  { color: "#94a3b8", label: "❓ UNVERIFIABLE" },
  };

  const rating = (a.rating || "UNVERIFIABLE").toUpperCase();
  const style  = ratingStyles[rating] || ratingStyles["UNVERIFIABLE"];

  const flagsHTML = Array.isArray(a.redFlags) && a.redFlags.length
    ? a.redFlags.map(f => `<li class="tl-flag-item">🚩 ${safe(f)}</li>`).join("")
    : `<li class="tl-flag-item tl-flag-none">✔ No major red flags detected</li>`;

  aiResponse.innerHTML = `
    <div class="tl-card" style="--card-accent:${style.color};">

      <div class="tl-card-header">
        <div class="tl-label">Headline analyzed</div>
        <blockquote class="tl-headline">"${safe(headline)}"</blockquote>
      </div>

      <div class="tl-rating-row">
        <div class="tl-badge" style="background:${style.color};">
          ${style.label}
        </div>
        <div class="tl-confidence">
          <span class="tl-conf-label">AI Confidence</span>
          <span class="tl-conf-value">${safe(a.confidence || "—")}</span>
        </div>
      </div>

      <div class="tl-sections">

        <div class="tl-section">
          <div class="tl-section-title">🎯 Bias &amp; Framing</div>
          <p class="tl-section-body">${safe(a.bias || "None detected.")}</p>
        </div>

        <div class="tl-section">
          <div class="tl-section-title">🚩 Red Flags</div>
          <ul class="tl-flags">${flagsHTML}</ul>
        </div>

        <div class="tl-section tl-verdict-section">
          <div class="tl-section-title">📋 Verdict</div>
          <p class="tl-section-body tl-verdict-text">${safe(a.verdict || "No verdict.")}</p>
        </div>

        <div class="tl-section tl-tip-section">
          <div class="tl-section-title">💡 How to Verify</div>
          <p class="tl-section-body">${safe(a.tip || "Cross-reference with multiple reputable sources.")}</p>
        </div>

      </div>

      <div class="tl-footer">
        <span>Powered by OpenRouter + Mistral AI</span>
        <span>·</span>
        <span>Not a substitute for professional fact-checking</span>
      </div>

    </div>
  `;
}


// ── STEP 9: LOADING ANIMATION ─────────────────────────────────

function buildLoadingHTML() {
  return `
    <div class="tl-loading">
      <div class="tl-spinner"></div>
      <p class="tl-loading-text">Cross-referencing the claim…</p>
      <div class="tl-skeleton-lines">
        <div class="tl-skeleton" style="width:75%"></div>
        <div class="tl-skeleton" style="width:55%"></div>
        <div class="tl-skeleton" style="width:65%"></div>
      </div>
    </div>
  `;
}


// ── STEP 10: ERROR DISPLAY ────────────────────────────────────

function showError(message, icon = "⚠️") {
  resultSection.style.display = "block";
  aiResponse.innerHTML = `
    <div class="tl-error">
      <div class="tl-error-icon">${icon}</div>
      <p class="tl-error-title">Analysis Failed</p>
      <p class="tl-error-msg">${safe(message)}</p>
      <p class="tl-error-hint">
        Press F12 → Console tab to see full error details.
      </p>
    </div>
  `;
}


// ── STEP 11: SECURITY — Prevent XSS ──────────────────────────

function safe(str) {
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;");
}
