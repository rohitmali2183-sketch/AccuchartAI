# AccuChart Provider Platform
## Complete 5-Stage Provider Workflow — Vercel Deployment Guide

### Project Structure
```
accuchart-provider/
├── api/
│   └── claude.js          ← Vercel serverless proxy (keeps API key secret)
├── src/
│   ├── main.jsx            ← React entry point
│   └── App.jsx             ← Complete 5-stage platform
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
└── README.md
```

---

### Deploy to Vercel in 5 Steps

**Step 1 — Push to GitHub**
```bash
git init
git add .
git commit -m "AccuChart provider platform"
gh repo create accuchart-provider --public
git push -u origin main
```

**Step 2 — Import to Vercel**
1. Go to vercel.com → New Project
2. Import your GitHub repo
3. Framework Preset: **Vite**
4. Build Command: `npm run build`
5. Output Directory: `dist`

**Step 3 — Add your API Key**
Vercel Dashboard → Your Project → Settings → Environment Variables
```
Name:   ANTHROPIC_API_KEY
Value:  sk-ant-api03-xxxxxxxxxxxxxxxxxxxx
```
(Get your key at console.anthropic.com)

**Step 4 — Deploy**
Click Deploy. Vercel builds and goes live in ~60 seconds.

**Step 5 — Done**
Your URL: `https://accuchart-provider.vercel.app`

---

### Local Development

```bash
npm install
npm install -g vercel     # Install Vercel CLI

# Create local env file
echo "ANTHROPIC_API_KEY=sk-ant-xxxx" > .env.local

# Run with Vercel dev (supports /api routes locally)
vercel dev
```

Then open http://localhost:3000

---

### How It Works

```
Browser → /api/claude → Vercel serverless function → Anthropic API
                ↑
         API key is SECRET
         (never in browser)
```

The `api/claude.js` file is a thin proxy. It:
1. Receives the request from React (no API key needed in frontend)
2. Adds your secret `ANTHROPIC_API_KEY` from environment
3. Streams the response back to the browser

---

### The 5 Stages

| Stage | What happens | AI involved |
|-------|-------------|-------------|
| 1. Pre-Chart | Patient brief generated before encounter | ✅ Live Claude call |
| 2. Scribe & SOAP | AI-generated note + section enhancer | ✅ Per section |
| 3. AI Coding | ICD/CPT codes with note anchoring + explanations | ✅ Per code on demand |
| 4. CMS-1500 | Auto-populated claim form | No AI (auto-fill) |
| 5. Submit & Track | Payment timeline + post-submission intelligence | ✅ Live Claude call |

---

### Cost Estimate (Anthropic API)

Using Claude Sonnet 4.6 ($3/$15 per million tokens):

| Usage | Est. API Cost |
|-------|--------------|
| Per encounter (all AI calls) | ~$0.04–0.06 |
| Per doctor per month (20 pts/day) | ~$20–30 |
| With prompt caching enabled | ~$5–10 |

At $400/month per doctor subscription, API costs are ~5-7% of revenue.

---

### Customizing Patient Data

Edit the `PATIENT` object at the top of `src/App.jsx` to use real patient data from your EHR. In production, this would be fetched from your API based on the encounter ID.

---

### Questions?
info@accuchart.ai | accuchart.ai
