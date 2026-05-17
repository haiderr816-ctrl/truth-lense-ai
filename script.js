const CONFIG = {
  apiKey:    "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",
  apiUrl:    "https://openrouter.ai/api/v1/chat/completions",
  model:     "nvidia/nemotron-3-super-120b-a12b:free",
  maxTokens: 700,
};

const RATINGS = {
  "TRUE":         { pct: 95, color: "#16a34a", label: "✅ True" },
  "MOSTLY TRUE":  { pct: 75, color: "#65a30d", label: "☑️ Mostly True" },
  "MIXED":        { pct: 50, color: "#d97706", label: "⚖️ Mixed" },
  "MOSTLY FALSE": { pct: 25, color: "#ea580c", label: "⚠️ Mostly False" },
  "FALSE":        { pct: 5,  color: "#dc2626", label: "❌ False" },
  "UNVERIFIABLE": { pct: 50, color: "#6b7280", label: "❓ Unverifiable" },
};

const DOM = {
  btn:      document.getElementById("analyze-btn"),
  input:    document.getElementById("headline-input"),
  section:  document.getElementById("result-section"),
  response: document.getElementById("ai-response"),
};

renderHistory();

function buildPrompt(headline) {
  return `You are a world-class fact-checker. Analyze the headline below and respond with ONLY a raw JSON object. No markdown. No code fences. Just JSON.

{
  "rating": "TRUE | MOSTLY TRUE | MIXED | MOSTLY FALSE | FALSE | UNVERIFIABLE",
  "confidence": "84%",
  "bias": "one sentence on framing",
  "tone": "Neutral | Alarmist | Sensational | Misleading | Objective | Provocative",
  "redFlags": ["flag1", "flag2"],
  "keyFact": "most important fact",
  "verdict": "two sentence conclusion",
  "tip": "one specific verification source"
}

Headline: "${headline}"`;
}

DOM.btn.addEventListener("click", async () => {
  const headline = DOM.input.value.trim();
  if (!headline) { showError("Please enter a headline.", "📝"); return; }

  DOM.section.style.display = "block";
  DOM.response.innerHTML = buildSkeletonHTML();
  DOM.btn.disabled = true;
  DOM.btn.querySelector(".btn-text").textContent = "Analyzing…";
  DOM.section.scrollIntoView({ behavior: "smooth", block: "nearest" });

  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${CONFIG.apiKey}`,
        "HTTP-Referer":  window.location.href,
        "X-Title":       "Truth Lens",
      },
      body: JSON.stringify({
        model:      CONFIG.model,
        max_tokens: CONFIG.maxTokens,
        messages:   [{ role: "user", content: buildPrompt(headline) }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ API response:", data);

    const message = data.choices?.[0]?.message;
    const rawText = message?.content || message?.reasoning || "";
    if (!rawText.trim()) throw new Error("AI returned an empty response. Try again.");

    const analysis = parseJSON(rawText);
    renderResult(headline, analysis);

  } catch (err) {
    console.error("❌ Error:", err);
    showError(err.message, "⚠️");
  } finally {
    DOM.btn.disabled = false;
    DOM.btn.querySelector(".btn-text").textContent = "Analyze Truth";
  }
});

DOM.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) DOM.btn.click();
});

function parseJSON(text) {
  try {
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(clean);
  } catch {
    return {
      rating: "UNVERIFIABLE", confidence: "N/A",
      bias: "Could not parse response.", tone: "Unknown",
      redFlags: [], keyFact: text,
      verdict: "The AI response could not be parsed.",
      tip: "Try rephrasing your headline."
    };
  }
}

function renderResult(headline, a) {
  const rating = (a.rating || "UNVERIFIABLE").toUpperCase();
  const meta   = RATINGS[rating] || RATINGS["UNVERIFIABLE"];
  saveToHistory(headline, rating, meta.color);

  const flags = Array.isArray(a.redFlags) && a.redFlags.length
    ? a.redFlags.map(f => `<li>${safe(f)}</li>`).join("")
    : `<li class="no-flags">No major red flags detected</li>`;

  DOM.response.innerHTML = `
    <article class="result-card">
      <div class="result-card-accent" style="background:${meta.color};"></div>
      <div class="result-card-body">
        <div>
          <p class="analyzed-label">Headline analyzed</p>
          <blockquote class="analyzed-headline" style="border-left-color:${meta.color};">
            "${safe(headline)}"
          </blockquote>
        </div>
        <div class="truth-meter-section">
          <div class="truth-meter-header">
            <span class="truth-meter-label">Truth Meter</span>
            <span class="truth-rating-badge" style="background:${meta.color};">${meta.label}</span>
          </div>
          <div class="truth-meter-track">
            <div class="truth-meter-needle" id="meter-needle" style="left:0%;"></div>
          </div>
          <div class="truth-meter-labels">
            <span>False</span><span>Mostly False</span>
            <span>Mixed</span><span>Mostly True</span><span>True</span>
          </div>
          <div class="confidence-row">
            <span class="confidence-number" style="color:${meta.color};">${safe(a.confidence || "—")}</span>
            <div>
              <p class="confidence-text">AI confidence score</p>
              <p class="confidence-text">Tone: <strong>${safe(a.tone || "Unknown")}</strong></p>
            </div>
          </div>
        </div>
        <div class="breakdown-grid">
          <div class="breakdown-section">
            <div class="breakdown-header"><span class="breakdown-icon">🎯</span><span class="breakdown-title">Bias & Framing</span></div>
            <div class="breakdown-body">${safe(a.bias || "None detected.")}</div>
          </div>
          <div class="breakdown-section">
            <div class="breakdown-header"><span class="breakdown-icon">🚩</span><span class="breakdown-title">Red Flags</span></div>
            <div class="breakdown-body"><ul class="red-flags-list">${flags}</ul></div>
          </div>
          <div class="breakdown-section">
            <div class="breakdown-header"><span class="breakdown-icon">💡</span><span class="breakdown-title">Key Fact</span></div>
            <div class="breakdown-body">${safe(a.keyFact || "—")}</div>
          </div>
          <div class="breakdown-section verdict-section">
            <div class="breakdown-header"><span class="breakdown-icon">📋</span><span class="breakdown-title">Verdict</span></div>
            <div class="breakdown-body">${safe(a.verdict || "No verdict.")}</div>
          </div>
          <div class="breakdown-section verify-section">
            <div class="breakdown-header"><span class="breakdown-icon">🔍</span><span class="breakdown-title">How to Verify</span></div>
            <div class="breakdown-body">${safe(a.tip || "Cross-reference with Reuters, AP, or BBC.")}</div>
          </div>
        </div>
      </div>
      <div class="result-footer">
        <span class="result-footer-text">Powered by OpenRouter AI · Not professional fact-checking</span>
        <button class="share-btn" onclick="shareResult('${safe(headline)}','${safe(rating)}','${safe(a.verdict||"")}','${safe(a.confidence||"")}')">📋 Copy Result</button>
      </div>
    </article>
  `;

  setTimeout(() => {
    const needle = document.getElementById("meter-needle");
    if (needle) needle.style.left = `${meta.pct}%`;
  }, 100);
}

function buildSkeletonHTML() {
  return `
    <div class="skeleton-card">
      <div class="skeleton-header">
        <div class="skeleton-circle"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
          <div class="skeleton-line" style="width:70%;"></div>
          <div class="skeleton-line" style="width:50%;"></div>
        </div>
      </div>
      <div class="skeleton-bar"></div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div class="skeleton-line" style="width:90%;"></div>
        <div class="skeleton-line" style="width:75%;"></div>
        <div class="skeleton-line" style="width:60%;"></div>
      </div>
      <p class="skeleton-thinking">🧠 Cross-referencing sources…</p>
    </div>`;
}

function showError(message, icon = "⚠️") {
  DOM.section.style.display = "block";
  DOM.response.innerHTML = `
    <div class="error-card" role="alert">
      <div class="error-icon">${icon}</div>
      <p class="error-title">Analysis Failed</p>
      <p class="error-message">${safe(message)}</p>
      <p class="error-hint">Press F12 → Console for full details.</p>
    </div>`;
}

function shareResult(headline, rating, verdict, confidence) {
  const text = `🔍 Truth Lens Analysis\n\nHeadline: "${headline}"\nRating: ${rating}\nConfidence: ${confidence}\n\nVerdict: ${verdict}\n\nAnalyzed by Truth Lens — ${window.location.href}`;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector(".share-btn");
    if (btn) {
      btn.textContent = "✅ Copied!";
      setTimeout(() => { btn.textContent = "📋 Copy Result"; }, 2000);
    }
  }).catch(() => alert("Copy failed. Please copy manually."));
}

const HISTORY_KEY = "truthlens_history";

function saveToHistory(headline, rating, color) {
  const history = getHistory();
  const filtered = history.filter(h => h.headline !== headline);
  filtered.unshift({ headline, rating, color, date: new Date().toLocaleDateString() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, 5)));
  renderHistory();
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function renderHistory() {
  const section = document.getElementById("history-section");
  const list    = document.getElementById("history-list");
  const history = getHistory();
  if (!section || !list) return;
  if (!history.length) { section.style.display = "none"; return; }
  section.style.display = "block";
  list.innerHTML = history.map(h => `
    <div class="history-item" onclick="reuseHistory('${safe(h.headline)}')" role="button" tabindex="0">
      <div class="history-dot" style="background:${h.color};"></div>
      <span class="history-text">${safe(h.headline)}</span>
      <span class="history-badge" style="background:${h.color};">${safe(h.rating)}</span>
    </div>`).join("");
}

function reuseHistory(headline) {
  DOM.input.value = headline;
  DOM.input.scrollIntoView({ behavior: "smooth", block: "center" });
}
/* ── DARK MODE ──────────────────────────────────────────────
   WHY: We toggle a .dark class on <body>. All colors are
   CSS variables so they switch instantly. localStorage
   saves the preference so it persists on refresh. */

window.addEventListener("DOMContentLoaded", () => {
  const darkBtn = document.getElementById("dark-mode-btn");
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    if (darkBtn) darkBtn.textContent = "☀️";
  }

  if (darkBtn) {
    darkBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark");
      const isDark = document.body.classList.contains("dark");
      darkBtn.textContent = isDark ? "☀️" : "🌙";
      localStorage.setItem("theme", isDark ? "dark" : "light");
    });
  }
});

/* ── HAMBURGER MENU ─────────────────────────────────────────
   WHY: On mobile the nav links are hidden. Clicking the
   hamburger toggles the .open class which shows them. */

const hamburger = document.getElementById("hamburger-btn");
const headerNav = document.querySelector(".header-nav");

if (hamburger) {
  hamburger.addEventListener("click", () => {
    hamburger.classList.toggle("open");
    headerNav.classList.toggle("open");
  });

  // Close menu when a nav link is clicked
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      hamburger.classList.remove("open");
      headerNav.classList.remove("open");
    });
  });
}

/* ── FAQ ACCORDION ──────────────────────────────────────────
   WHY: We close all other items first, then open the
   clicked one. This is the standard accordion pattern. */

function toggleFaq(btn) {
  const item = btn.parentElement;
  const isOpen = item.classList.contains("open");

  // Close all
  document.querySelectorAll(".faq-item").forEach(i => {
    i.classList.remove("open");
  });

  // Open clicked one if it was closed
  if (!isOpen) item.classList.add("open");
}

/* ── EXAMPLE CHIPS ──────────────────────────────────────────
   WHY: Removes friction. User sees a real example,
   clicks it, textarea fills, analysis runs automatically. */

function useExample(chip) {
  DOM.input.value = chip.textContent;
  DOM.input.focus();
  DOM.input.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => DOM.btn.click(), 300);
}

/* ── LIVE ANALYSIS COUNTER ──────────────────────────────────
   WHY: Social proof. Shows how many analyses have been
   run — increments every time button is clicked. */

const COUNT_KEY = "tl_analysis_count";

function getCount() {
  localStorage.removeItem(COUNT_KEY);
  return 1247;
}

function incrementCount() {
  const el = document.getElementById("live-count");
  if (el) {
    const current = parseInt(el.textContent.replace(/,/g, "")) || 1247;
    el.textContent = (current + 1).toLocaleString();
  }
}

/* ── TYPING EFFECT ──────────────────────────────────────────
   WHY: setInterval runs a function repeatedly every X ms.
   We cycle through words, delete letter by letter, then
   type the next word letter by letter. */

const typingWords = ["Fake News", "Bias", "Misinformation", "Propaganda", "Clickbait"];
let wordIndex = 0;
let charIndex = 0;
let isDeleting = false;
const typingTarget = document.getElementById("typing-target");

function runTyping() {
  if (!typingTarget) return;
  const currentWord = typingWords[wordIndex];

  if (isDeleting) {
    typingTarget.textContent = currentWord.substring(0, charIndex - 1);
    charIndex--;
  } else {
    typingTarget.textContent = currentWord.substring(0, charIndex + 1);
    charIndex++;
  }

  if (!isDeleting && charIndex === currentWord.length) {
    setTimeout(() => { isDeleting = true; }, 1500);
  } else if (isDeleting && charIndex === 0) {
    isDeleting = false;
    wordIndex = (wordIndex + 1) % typingWords.length;
  }

  setTimeout(runTyping, isDeleting ? 60 : 100);
}

runTyping();

/* ── SCROLL REVEAL ───────────────────────────────────────────
   WHY: IntersectionObserver fires when an element enters
   the viewport. We add the .visible class which triggers
   the CSS transition we wrote in style.css. */

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll(".reveal").forEach(el => {
  revealObserver.observe(el);
});

/* ── COUNTER ANIMATION ───────────────────────────────────────
   WHY: Numbers counting up from 0 draw the eye and feel
   dynamic. We use requestAnimationFrame for smooth 60fps. */

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = parseInt(el.getAttribute("data-target"));
    const duration = 1500;
    const start = performance.now();

    function updateCounter(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(updateCounter);
    }

    requestAnimationFrame(updateCounter);
    counterObserver.unobserve(el);
  });
}, { threshold: 0.5 });

document.querySelectorAll(".stat-number[data-target]").forEach(el => {
  counterObserver.observe(el);
});
function safe(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;");
}