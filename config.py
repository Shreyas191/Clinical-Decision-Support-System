from dotenv import load_dotenv
import os

load_dotenv()

GROQ_API_KEY   = os.getenv("GROQ_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

LLM_MODEL  = "llama-3.3-70b-versatile"
EMBED_MODEL = "models/gemini-embedding-001"
CHROMA_PATH = "./vectorstore/chroma_db"

_DATA_DIR   = os.getenv("DATA_DIR", ".")
SQLITE_PATH = os.path.join(_DATA_DIR, "sessions.db")

CHUNK_SIZE       = 512
CHUNK_OVERLAP    = 50
TOP_K_GUIDELINES = 5
TOP_K_DRUGS      = 3
TOP_K_PATIENTS   = 3
