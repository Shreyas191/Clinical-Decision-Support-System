"""
CDSS FastAPI backend.

Endpoints:
  POST /query                    — main clinical decision support query
  POST /query/stream             — streaming version (SSE)
  POST /query/with-patient       — query with injected EHR patient record
  GET  /ehr/patients             — list all EHR patients (id/name/age/complaint)
  GET  /ehr/patients/{id}        — full patient record by ID
  GET  /sessions/{id}/history    — conversation history for a session
  GET  /health                   — liveness check
"""

import json
import uuid
from pathlib import Path
from typing import AsyncGenerator

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agents.guardrails import check_input, validate_output
from agents.supervisor import app_graph
from auth import admin_router, get_current_user, router as auth_router

# ── EHR data ─────────────────────────────────────────────────────────────────
_EHR_PATH = Path(__file__).parent / "data" / "mock_ehr" / "patients.json"
_ehr_patients: list[dict] = json.loads(_EHR_PATH.read_text())
_ehr_index: dict[str, dict] = {p["patient_id"]: p for p in _ehr_patients}

app = FastAPI(
    title="CDSS — Clinical Decision Support System",
    description="Multi-agent clinical decision support using LangGraph + Groq + Gemini. $0 cost.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)


# ── Request / response models ─────────────────────────────────────────────────
class QueryRequest(BaseModel):
    query: str
    session_id: str | None = None


class PatientQueryRequest(BaseModel):
    query: str
    patient_id: str
    session_id: str | None = None


class QueryResponse(BaseModel):
    response: dict
    traces: list
    session_id: str
    blocked: bool = False
    error: str | None = None


class PatientSummary(BaseModel):
    patient_id: str
    name: str
    age: int
    gender: str
    chief_complaint: str


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "llm": "groq/llama-3.3-70b-versatile",
        "embeddings": "gemini/text-embedding-004",
        "vector_store": "chromadb",
        "session_store": "sqlite",
    }


@app.post("/query", response_model=QueryResponse)
def query(req: QueryRequest, _user: dict = Depends(get_current_user)):
    session_id = req.session_id or str(uuid.uuid4())

    # Input guardrail
    guard = check_input(req.query)
    if not guard["safe"]:
        return QueryResponse(
            response={},
            traces=[],
            session_id=session_id,
            blocked=True,
            error=guard["reason"],
        )

    # Run the multi-agent graph
    config = {"configurable": {"thread_id": session_id}}
    try:
        result = app_graph.invoke(
            {"query": guard["sanitized_query"], "traces": []},
            config=config,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Graph invocation failed: {e}")

    final = result.get("final_response", {})

    # Output guardrail
    if not validate_output(final):
        final["escalate_flag"] = True
        final["safety_note"] = "Response flagged for clinical review — please consult a clinician."

    return QueryResponse(
        response=final,
        traces=result.get("traces", []),
        session_id=session_id,
    )


@app.post("/query/stream")
async def query_stream(req: QueryRequest, _user: dict = Depends(get_current_user)):
    """
    Streaming endpoint — returns synthesis tokens via Server-Sent Events.
    Frontend connects with EventSource or fetch + ReadableStream.
    """
    session_id = req.session_id or str(uuid.uuid4())
    guard = check_input(req.query)

    if not guard["safe"]:
        async def blocked():
            yield f"data: {guard['reason']}\n\n"
        return StreamingResponse(blocked(), media_type="text/event-stream")

    config = {"configurable": {"thread_id": session_id}}

    async def token_stream() -> AsyncGenerator[str, None]:
        async for event in app_graph.astream(
            {"query": guard["sanitized_query"], "traces": []},
            config=config,
            stream_mode="messages",
        ):
            if isinstance(event, tuple):
                msg, meta = event
                if hasattr(msg, "content") and meta.get("langgraph_node") == "synthesis":
                    yield f"data: {msg.content}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(token_stream(), media_type="text/event-stream")


@app.get("/ehr/patients", response_model=list[PatientSummary])
def ehr_patients(_user: dict = Depends(get_current_user)):
    return [
        {
            "patient_id": p["patient_id"],
            "name": p["name"],
            "age": p["age"],
            "gender": p["gender"],
            "chief_complaint": p["chief_complaint"],
        }
        for p in _ehr_patients
    ]


@app.get("/ehr/patients/{patient_id}")
def ehr_patient(patient_id: str, _user: dict = Depends(get_current_user)):
    patient = _ehr_index.get(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return patient


@app.post("/query/with-patient", response_model=QueryResponse)
def query_with_patient(req: PatientQueryRequest, _user: dict = Depends(get_current_user)):
    session_id = req.session_id or str(uuid.uuid4())

    patient = _ehr_index.get(req.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {req.patient_id} not found")

    guard = check_input(req.query)
    if not guard["safe"]:
        return QueryResponse(
            response={},
            traces=[],
            session_id=session_id,
            blocked=True,
            error=guard["reason"],
        )

    config = {"configurable": {"thread_id": session_id}}
    try:
        result = app_graph.invoke(
            {
                "query": guard["sanitized_query"],
                "traces": [],
                "patient_context_override": patient,
            },
            config=config,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Graph invocation failed: {e}")

    final = result.get("final_response", {})
    if not validate_output(final):
        final["escalate_flag"] = True
        final["safety_note"] = "Response flagged for clinical review — please consult a clinician."

    return QueryResponse(
        response=final,
        traces=result.get("traces", []),
        session_id=session_id,
    )


@app.get("/sessions/{session_id}/history")
def session_history(session_id: str):
    """Return the last 10 turns for a session from SQLite checkpointer."""
    try:
        config = {"configurable": {"thread_id": session_id}}
        state = app_graph.get_state(config)
        if not state or not state.values:
            return {"session_id": session_id, "turns": []}

        # Extract query/response pairs from checkpoint
        values = state.values
        turn = {
            "query": values.get("query", ""),
            "response": values.get("final_response", {}).get("recommendation", ""),
        }
        return {"session_id": session_id, "turns": [turn] if turn["query"] else []}
    except Exception:
        return {"session_id": session_id, "turns": []}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
