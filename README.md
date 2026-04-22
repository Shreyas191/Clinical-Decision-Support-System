# CDSS — Clinical Decision Support System (Free Stack)

A multi-agent clinical decision support platform built entirely with free tools.
Zero cloud costs. Fully local development. Deploy to free hosting tiers.

> **Data:** Uses only public guidelines (PDFs you download) and synthetic patient
> data (Synthea or built-in placeholders). No real PHI is ever processed.

---

## Architecture

```
React (Vite + Tailwind)
    │
    ▼  POST /query
FastAPI (main.py)
    │
    ├── Guardrails (input check)
    │
    ▼
LangGraph StateGraph
    ├── GuidelinesAgent  ──── ChromaDB (guidelines collection)
    ├── DrugAgent        ──── ChromaDB (drugs collection) + OpenFDA API
    └── PatientAgent     ──── ChromaDB (patients collection)
                │ (parallel, all feed into)
                ▼
          SynthesisAgent ──── Groq Llama 3.3 70B
                │
    ├── Guardrails (output validation)
    └── Response → frontend

Session memory: SQLite (langgraph SqliteSaver)
Embeddings: Gemini text-embedding-004 (free)
LLM: Groq Llama 3.3 70B (free, 14k req/day)
Vector store: ChromaDB (local persistent)
```

---

## Quickstart

### 1. Get free API keys (no credit card needed)

| Key | URL | Free limit |
|-----|-----|-----------|
| `GROQ_API_KEY` | https://console.groq.com | 14,400 req/day |
| `GOOGLE_API_KEY` | https://aistudio.google.com | 1M embed tokens/day |

```bash
cp .env.example .env
# Edit .env and paste your keys
```

### 2. Install Python dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Prepare data

```bash
# Pull drug data from OpenFDA (free, no key needed, ~2 min)
python3 data/scripts/pull_openfda.py

# Generate synthetic patient summaries
# Option A: Use built-in placeholders (instant, no Java needed)
python3 data/scripts/parse_synthea.py

# Option B: Real Synthea (more data, needs Java)
# java -jar synthea.jar -p 50
# python3 data/scripts/parse_synthea.py --input synthea/output/fhir

# Add guideline PDFs to data/guidelines/
# Download from: ADA (diabetesjournals.org), ACC/AHA (ahajournals.org), NICE (nice.org.uk)
# (ingest works even without PDFs — drug + patient collections will still load)
```

### 4. Ingest into ChromaDB

```bash
python3 vectorstore/ingest.py
# Output: vectorstore/chroma_db/ (persisted to disk)
```

### 5. Run the backend

```bash
python3 main.py
# → http://localhost:8000
# → Docs: http://localhost:8000/docs
```

### 6. Run the frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
# → http://localhost:5173
```

---

## Test with curl

```bash
# Health check
curl http://localhost:8000/health

# Clinical query
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "65yo with T2DM (HbA1c 8.2%) and hypertension (BP 145/92) on metformin 1000mg BID. Evidence-based next steps?"
  }'
```

---

## Run evaluation

```bash
# With backend running in another terminal:
python3 tests/run_eval.py
# Outputs: tests/eval_results.json
```

---

## Deploy (free)

### Backend → Render.com

1. Push to GitHub
2. Go to render.com → New Web Service → connect repo
3. Build command: `pip install -r requirements.txt && python3 data/scripts/pull_openfda.py && python3 data/scripts/parse_synthea.py && python3 vectorstore/ingest.py`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add `GROQ_API_KEY` and `GOOGLE_API_KEY` as environment variables
6. Deploy

### Frontend → Vercel

```bash
cd frontend
# Set VITE_API_URL to your Render backend URL in .env.local
npx vercel deploy
```

---

## Project structure

```
cdss-free/
├── main.py                          # FastAPI app — all endpoints
├── config.py                        # All settings + constants
├── requirements.txt
├── .env.example                     # Copy to .env, add your keys
│
├── agents/
│   ├── supervisor.py                # LangGraph graph — core of the system
│   └── guardrails.py                # Input + output safety checks
│
├── vectorstore/
│   └── ingest.py                    # ChromaDB ingestion for all 3 collections
│
├── data/
│   ├── guidelines/                  # Add PDFs here (ADA, ACC/AHA, NICE)
│   ├── drug_interactions/           # Auto-populated by pull_openfda.py
│   ├── synthetic_patients/          # Auto-populated by parse_synthea.py
│   └── scripts/
│       ├── pull_openfda.py          # Pull drug data (free OpenFDA API)
│       └── parse_synthea.py         # Parse Synthea FHIR → summaries
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Root component
│   │   ├── types.ts                 # TypeScript interfaces
│   │   ├── hooks/
│   │   │   └── useCDSS.ts          # API calls + session state
│   │   └── components/
│   │       ├── QueryInput.tsx       # Clinical scenario textarea + submit
│   │       ├── AgentTracePanel.tsx  # Accordion showing each agent's work
│   │       ├── ResponsePanel.tsx    # Structured response display
│   │       └── HistoryPanel.tsx     # Session turn history
│   ├── package.json
│   └── vite.config.ts
│
└── tests/
    ├── run_eval.py                  # Automated evaluation runner
    └── eval_cases/
        └── cases.json               # 5 clinical test cases
```

---

## Stack comparison

| Concern | AWS Bedrock (paid) | This stack (free) |
|---|---|---|
| LLM | Claude 3.5 Sonnet | Llama 3.3 70B via Groq |
| Embeddings | Titan Embed v2 | Gemini text-embedding-004 |
| Agent orchestration | Bedrock Agents | LangGraph StateGraph |
| Vector store | OpenSearch Serverless | ChromaDB (local) |
| Session memory | DynamoDB | SQLite |
| Hosting | Localhost | (add FastAPI JWT if needed) |
| Monthly cost | $0 | $0 |
