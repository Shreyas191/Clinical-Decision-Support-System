"""
CDSS Supervisor — LangGraph multi-agent graph.

Architecture:
  START ──┬── guidelines_node ──┐
          ├── drug_node         ├── synthesis_node ── END
          └── patient_node    ──┘

All three retrieval agents run in parallel; synthesis waits for all three.
Session memory persisted via SqliteSaver (SQLite).
"""

import json
import operator
import sqlite3
import time
from typing import Annotated, TypedDict

import chromadb
from langchain_community.vectorstores import Chroma
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_groq import ChatGroq
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph

from config import (
    CHROMA_PATH,
    EMBED_MODEL,
    LLM_MODEL,
    SQLITE_PATH,
    TOP_K_DRUGS,
    TOP_K_GUIDELINES,
    TOP_K_PATIENTS,
)

# ── Shared singletons ─────────────────────────────────────────────────────────
llm = ChatGroq(model=LLM_MODEL, temperature=0.1)
embeddings = GoogleGenerativeAIEmbeddings(model=EMBED_MODEL)


def get_retriever(collection: str, k: int):
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    db = Chroma(
        client=client,
        collection_name=collection,
        embedding_function=embeddings,
    )
    return db.as_retriever(search_kwargs={"k": k})


def _parse_json(text: str, fallback: dict) -> dict:
    """Strip markdown fences and parse JSON; return fallback on failure."""
    clean = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(clean)
    except Exception:
        return fallback


# ── Graph state ───────────────────────────────────────────────────────────────
class CDSSState(TypedDict):
    query: str
    guidelines_out: dict
    drug_out: dict
    patient_out: dict
    final_response: dict
    traces: Annotated[list, operator.add]
    patient_context_override: dict  # optional — set to bypass ChromaDB retrieval


# ── Agent nodes ───────────────────────────────────────────────────────────────
def guidelines_node(state: CDSSState) -> dict:
    t0 = time.time()
    retriever = get_retriever("guidelines", TOP_K_GUIDELINES)
    docs = retriever.invoke(state["query"])
    context = "\n\n".join(d.page_content for d in docs)
    sources = [d.metadata.get("source", "unknown") for d in docs]

    response = llm.invoke(
        [
            SystemMessage(
                content="""You are a clinical guidelines specialist.
Given the context below, extract evidence-based recommendations relevant to the query.
Respond ONLY with valid JSON matching this exact schema (no markdown, no extra text):
{"recommendations": ["..."], "citations": ["Source Year: summary"], "evidence_levels": ["A", "B", or "C"]}
Never diagnose. Always cite source and year. Evidence level A=strong RCT evidence, B=moderate, C=expert opinion."""
            ),
            HumanMessage(content=f"Query: {state['query']}\n\nContext:\n{context}"),
        ]
    )

    out = _parse_json(
        response.content,
        fallback={
            "recommendations": [response.content],
            "citations": sources,
            "evidence_levels": ["C"],
        },
    )

    trace = {
        "agent": "Guidelines",
        "latency_ms": int((time.time() - t0) * 1000),
        "docs_retrieved": len(docs),
        "output_summary": str(out)[:300],
    }
    return {
        "guidelines_out": out,
        "traces": [trace],
    }


def drug_node(state: CDSSState) -> dict:
    t0 = time.time()
    retriever = get_retriever("drugs", TOP_K_DRUGS)
    docs = retriever.invoke(state["query"])
    context = "\n\n".join(d.page_content for d in docs)

    response = llm.invoke(
        [
            SystemMessage(
                content="""You are a clinical pharmacist specialist.
Analyze drug interactions, contraindications, and safety concerns for the clinical scenario.
Respond ONLY with valid JSON (no markdown, no extra text):
{"interactions": ["..."], "contraindications": ["..."], "safety_flags": ["..."], "severity": "major|moderate|minor|none"}
Always flag severity level. Never prescribe or recommend specific doses."""
            ),
            HumanMessage(
                content=f"Query: {state['query']}\n\nDrug reference data:\n{context}"
            ),
        ]
    )

    out = _parse_json(
        response.content,
        fallback={
            "interactions": [],
            "contraindications": [],
            "safety_flags": [response.content],
            "severity": "unknown",
        },
    )

    trace = {
        "agent": "Drug",
        "latency_ms": int((time.time() - t0) * 1000),
        "docs_retrieved": len(docs),
        "output_summary": str(out)[:300],
    }
    return {
        "drug_out": out,
        "traces": [trace],
    }


def patient_node(state: CDSSState) -> dict:
    t0 = time.time()
    override = state.get("patient_context_override")

    if override:
        # Direct EHR injection — skip ChromaDB entirely
        out = {
            "conditions": override.get("active_conditions", []),
            "medications": [
                f"{m['name']} {m['dose']} {m['frequency']}"
                for m in override.get("current_medications", [])
            ],
            "relevant_labs": {
                k: f"{v['value']} {v['unit']}"
                for k, v in override.get("recent_labs", {}).items()
            },
            "allergies": override.get("allergies", []),
            "chief_complaint": override.get("chief_complaint", ""),
            "visit_history": override.get("visit_history", []),
        }
        trace = {
            "agent": "Patient",
            "latency_ms": int((time.time() - t0) * 1000),
            "docs_retrieved": 0,
            "output_summary": f"EHR override: {override.get('name', 'Unknown')} (ID {override.get('patient_id', '?')})",
        }
    else:
        retriever = get_retriever("patients", TOP_K_PATIENTS)
        docs = retriever.invoke(state["query"])
        context = "\n\n".join(d.page_content for d in docs)

        response = llm.invoke(
            [
                SystemMessage(
                    content="""You are a patient history analyst.
Extract patient context relevant to the clinical query from the synthetic records below.
Respond ONLY with valid JSON (no markdown, no extra text):
{"conditions": ["..."], "medications": ["..."], "relevant_labs": {"lab_name": "value unit"}, "allergies": ["..."]}
Never output patient IDs. De-identify all output. Use only synthetic data."""
                ),
                HumanMessage(
                    content=f"Query: {state['query']}\n\nSynthetic patient records:\n{context}"
                ),
            ]
        )

        out = _parse_json(
            response.content,
            fallback={
                "conditions": [],
                "medications": [],
                "relevant_labs": {},
                "allergies": [],
            },
        )
        trace = {
            "agent": "Patient",
            "latency_ms": int((time.time() - t0) * 1000),
            "docs_retrieved": len(docs),
            "output_summary": str(out)[:300],
        }

    return {
        "patient_out": out,
        "traces": [trace],
    }


def synthesis_node(state: CDSSState) -> dict:
    t0 = time.time()
    combined = json.dumps(
        {
            "guidelines": state.get("guidelines_out", {}),
            "drug_safety": state.get("drug_out", {}),
            "patient_context": state.get("patient_out", {}),
        },
        indent=2,
    )

    response = llm.invoke(
        [
            SystemMessage(
                content="""You are a clinical decision support synthesizer.
Combine all agent outputs into a single, coherent clinical decision support summary.
Respond ONLY with valid JSON (no markdown, no extra text):
{
  "recommendation": "Clear prose summary of evidence-based options for the clinician to consider...",
  "citations": ["Source Year: key finding"],
  "evidence_level": "A|B|C",
  "safety_flags": ["Any drug interactions or contraindications to flag"],
  "disclaimer": "This information is for clinical decision support only. Final clinical decisions rest with the treating clinician.",
  "escalate_flag": false
}
RULES:
- NEVER diagnose ("you have X")
- NEVER prescribe ("take X mg of Y")
- ALWAYS include the disclaimer verbatim
- Set escalate_flag=true if confidence is low or the case is unusually complex
- Cite at least one source"""
            ),
            HumanMessage(
                content=f"Clinical query: {state['query']}\n\nAll agent outputs:\n{combined}"
            ),
        ]
    )

    disclaimer = (
        "This information is for clinical decision support only. "
        "Final clinical decisions rest with the treating clinician."
    )
    out = _parse_json(
        response.content,
        fallback={
            "recommendation": response.content,
            "citations": [],
            "evidence_level": "C",
            "safety_flags": [],
            "disclaimer": disclaimer,
            "escalate_flag": True,
        },
    )
    # Always enforce disclaimer even if LLM omitted it
    out.setdefault("disclaimer", disclaimer)

    trace = {
        "agent": "Synthesis",
        "latency_ms": int((time.time() - t0) * 1000),
        "output_summary": out.get("recommendation", "")[:300],
    }
    return {
        "final_response": out,
        "traces": [trace],
    }


# ── Build & compile graph ─────────────────────────────────────────────────────
def build_graph():
    g = StateGraph(CDSSState)

    g.add_node("guidelines", guidelines_node)
    g.add_node("drug", drug_node)
    g.add_node("patient", patient_node)
    g.add_node("synthesis", synthesis_node)

    # Parallel fan-out from START
    g.add_edge(START, "guidelines")
    g.add_edge(START, "drug")
    g.add_edge(START, "patient")

    # Fan-in: all three feed synthesis
    g.add_edge("guidelines", "synthesis")
    g.add_edge("drug", "synthesis")
    g.add_edge("patient", "synthesis")

    g.add_edge("synthesis", END)

    conn = sqlite3.connect(SQLITE_PATH, check_same_thread=False)
    memory = SqliteSaver(conn)

    return g.compile(checkpointer=memory)


# Module-level compiled graph (imported by main.py)
app_graph = build_graph()
