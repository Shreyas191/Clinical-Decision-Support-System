"""
Pull drug interaction data from the free public OpenFDA API.
No API key required.

Usage:
    python3 data/scripts/pull_openfda.py
"""

import json
import time
import urllib.request
from pathlib import Path

OPENFDA_BASE = "https://api.fda.gov/drug/label.json"

TARGET_DRUGS = [
    # Diabetes
    "metformin", "glipizide", "sitagliptin", "empagliflozin", "liraglutide", "dapagliflozin",
    # Hypertension
    "lisinopril", "amlodipine", "losartan", "metoprolol", "hydrochlorothiazide", "carvedilol",
    # Statins
    "atorvastatin", "rosuvastatin", "simvastatin",
    # Anticoagulants
    "warfarin", "apixaban", "rivaroxaban",
    # Other common
    "aspirin", "omeprazole", "furosemide", "allopurinol", "fluconazole",
]

OUTPUT_DIR = Path(__file__).parent.parent / "drug_interactions"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def fetch_drug(drug_name: str) -> dict:
    url = f"{OPENFDA_BASE}?search=openfda.generic_name:{drug_name}&limit=1"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CDSS-Research/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        r = data.get("results", [{}])[0]
        return {
            "drug_name": drug_name,
            "brand_names": r.get("openfda", {}).get("brand_name", []),
            "drug_class": r.get("openfda", {}).get("pharm_class_epc", []),
            "drug_interactions": r.get("drug_interactions", ["No interaction data available"])[:2],
            "contraindications": r.get("contraindications", ["No contraindication data available"])[:2],
            "warnings": r.get("warnings", ["No warnings data available"])[:2],
            "dosage_info": r.get("dosage_and_administration", ["See prescribing information"])[:1],
        }
    except Exception as e:
        print(f"  WARN: {drug_name} failed — {e}")
        return {"drug_name": drug_name, "error": str(e)}


def main():
    results = []
    for i, drug in enumerate(TARGET_DRUGS):
        print(f"[{i+1}/{len(TARGET_DRUGS)}] Fetching {drug}...")
        results.append(fetch_drug(drug))
        time.sleep(0.4)  # polite rate limiting (OpenFDA: 240 req/min)

    out_path = OUTPUT_DIR / "interactions.json"
    out_path.write_text(json.dumps(results, indent=2))
    print(f"\nSaved {len(results)} drugs → {out_path}")


if __name__ == "__main__":
    main()
