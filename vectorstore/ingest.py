"""
Ingest all data sources into ChromaDB collections.

Run once before starting the API:
    python3 vectorstore/ingest.py

Collections created:
  - guidelines  → chunked PDFs from data/guidelines/
  - drugs       → JSON from data/drug_interactions/interactions.json
  - patients    → JSON from data/synthetic_patients/summaries.json
"""

import json
import sys
import time
from pathlib import Path

import chromadb
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from langchain_google_genai import GoogleGenerativeAIEmbeddings

# Allow imports from project root
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CHROMA_PATH, CHUNK_OVERLAP, CHUNK_SIZE, EMBED_MODEL

embeddings = GoogleGenerativeAIEmbeddings(model=EMBED_MODEL)
splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=["\n\n", "\n", ". ", " ", ""],
)


def ingest_guidelines():
    guidelines_dir = Path("data/guidelines")
    pdfs = list(guidelines_dir.glob("*.pdf"))

    if not pdfs:
        print("  SKIP: no PDFs in data/guidelines/ — add guideline PDFs first")
        return 0

    all_docs = []
    for pdf in pdfs:
        print(f"  Loading {pdf.name}...")
        loader = PyPDFLoader(str(pdf))
        pages = loader.load()
        for page in pages:
            page.metadata.update(
                {
                    "source": pdf.stem,
                    "type": "guideline",
                    "filename": pdf.name,
                }
            )
        chunks = splitter.split_documents(pages)
        all_docs.extend(chunks)

    Chroma.from_documents(
        all_docs,
        embeddings,
        collection_name="guidelines",
        persist_directory=CHROMA_PATH,
    )
    print(f"  Guidelines: {len(all_docs)} chunks from {len(pdfs)} PDFs")
    return len(all_docs)


def batch_add_to_chroma(docs, collection_name, batch_size=50, delay=5):
    """Add documents to Chroma in batches with retries to avoid rate limits."""
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    vectorstore = Chroma(
        client=client,
        collection_name=collection_name,
        embedding_function=embeddings,
    )
    
    total = len(docs)
    for i in range(0, total, batch_size):
        batch = docs[i : i + batch_size]
        print(f"    Adding batch {i//batch_size + 1}/{(total-1)//batch_size + 1}...")
        
        retries = 3
        while retries > 0:
            try:
                vectorstore.add_documents(batch)
                break
            except Exception as e:
                if "429" in str(e):
                    print(f"      Rate limit hit, waiting 20s... ({retries} retries left)")
                    time.sleep(20)
                    retries -= 1
                else:
                    raise e
        else:
            print("      Failed to add batch after retries.")
            sys.exit(1)

        if i + batch_size < total:
            time.sleep(delay)


def ingest_drugs():
    drug_file = Path("data/drug_interactions/interactions.json")
    if not drug_file.exists():
        print("  SKIP: data/drug_interactions/interactions.json not found — run pull_openfda.py first")
        return 0

    interactions = json.loads(drug_file.read_text())
    raw_docs = [
        Document(
            page_content=json.dumps(drug, indent=2),
            metadata={
                "drug_name": drug.get("drug_name", "unknown"),
                "type": "drug",
            },
        )
        for drug in interactions
    ]
    docs = splitter.split_documents(raw_docs)

    batch_add_to_chroma(docs, "drugs")
    print(f"  Drugs: {len(docs)} drug documents")
    return len(docs)


def ingest_patients():
    patient_file = Path("data/synthetic_patients/summaries.json")
    if not patient_file.exists():
        print("  SKIP: data/synthetic_patients/summaries.json not found — run parse_synthea.py first")
        return 0

    summaries = json.loads(patient_file.read_text())
    raw_docs = [
        Document(
            page_content=json.dumps(p, indent=2),
            metadata={
                "patient_id": p.get("patient_id", "unknown"),
                "type": "patient",
            },
        )
        for p in summaries
    ]
    docs = splitter.split_documents(raw_docs)

    batch_add_to_chroma(docs, "patients")
    print(f"  Patients: {len(docs)} synthetic patient summaries")
    return len(docs)


if __name__ == "__main__":
    print("Starting ingestion...")
    print("\n[1/3] Guidelines")
    ingest_guidelines()
    print("\n[2/3] Drug interactions")
    ingest_drugs()
    print("\n[3/3] Synthetic patients")
    ingest_patients()
    print("\nIngestion complete. ChromaDB persisted to:", CHROMA_PATH)
