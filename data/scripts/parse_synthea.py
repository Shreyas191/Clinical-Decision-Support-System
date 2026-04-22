"""
Parse Synthea FHIR R4 JSON output into flat patient summaries.

1. Install Java: sudo apt install default-jre  (or brew install openjdk)
2. Download Synthea: https://github.com/synthetichealth/synthea/releases
3. Generate patients: java -jar synthea.jar -p 50
4. Run this script: python3 data/scripts/parse_synthea.py \
       --input synthea/output/fhir \
       --output data/synthetic_patients

Output: summaries.json — list of flat de-identified patient dicts.
"""

import argparse
import json
from pathlib import Path


def parse_bundle(bundle: dict) -> dict | None:
    resources: dict[str, list] = {}
    for entry in bundle.get("entry", []):
        r = entry.get("resource", {})
        rt = r.get("resourceType", "")
        resources.setdefault(rt, []).append(r)

    patients = resources.get("Patient", [])
    if not patients:
        return None
    p = patients[0]

    conditions = [
        c.get("code", {}).get("coding", [{}])[0].get("display", "Unknown")
        for c in resources.get("Condition", [])
        if c.get("clinicalStatus", {})
           .get("coding", [{}])[0].get("code") == "active"
    ]

    medications = [
        m.get("medicationCodeableConcept", {})
         .get("coding", [{}])[0].get("display", "Unknown")
        for m in resources.get("MedicationRequest", [])
        if m.get("status") == "active"
    ]

    labs: dict[str, str] = {}
    for obs in resources.get("Observation", []):
        if obs.get("status") != "final":
            continue
        code = obs.get("code", {}).get("coding", [{}])[0].get("display", "")
        val = obs.get("valueQuantity", {})
        if code and val:
            labs[code] = f"{val.get('value', '')} {val.get('unit', '')}".strip()

    allergies = [
        a.get("code", {}).get("coding", [{}])[0].get("display", "Unknown")
        for a in resources.get("AllergyIntolerance", [])
    ]

    return {
        "patient_id":  p.get("id", ""),
        "gender":      p.get("gender", "unknown"),
        "birth_year":  (p.get("birthDate", "")[:4] if p.get("birthDate") else ""),
        "conditions":  conditions[:10],
        "medications": medications[:10],
        "recent_labs": dict(list(labs.items())[:10]),
        "allergies":   allergies[:5],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input",  default="synthea/output/fhir")
    parser.add_argument("--output", default="data/synthetic_patients")
    args = parser.parse_args()

    in_dir  = Path(args.input)
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    summaries = []
    if not in_dir.exists():
        print(f"Input dir {in_dir} not found — create synthetic data manually or run Synthea first.")
        # Write a small set of placeholder summaries so ingest.py works immediately
        summaries = _placeholder_summaries()
    else:
        for fhir_file in in_dir.glob("*.json"):
            bundle = json.loads(fhir_file.read_text())
            s = parse_bundle(bundle)
            if s:
                summaries.append(s)

    out_path = out_dir / "summaries.json"
    out_path.write_text(json.dumps(summaries, indent=2))
    print(f"Wrote {len(summaries)} patient summaries → {out_path}")


def _placeholder_summaries() -> list:
    """10 synthetic patient summaries for development without Synthea."""
    return [
        {
            "patient_id": f"synthetic-{i:03d}",
            "gender": ["male", "female"][i % 2],
            "birth_year": str(1940 + i * 5),
            "conditions": conds,
            "medications": meds,
            "recent_labs": labs,
            "allergies": allergy,
        }
        for i, (conds, meds, labs, allergy) in enumerate([
            (["Type 2 diabetes mellitus", "Hypertension"],
             ["Metformin 1000mg", "Lisinopril 10mg"],
             {"HbA1c": "8.2 %", "eGFR": "72 mL/min", "BP": "145/92 mmHg"}, ["Penicillin"]),
            (["Heart failure with reduced ejection fraction", "Type 2 diabetes"],
             ["Carvedilol 25mg", "Furosemide 40mg", "Empagliflozin 10mg"],
             {"EF": "35 %", "BNP": "450 pg/mL", "eGFR": "48 mL/min"}, []),
            (["CKD Stage 3", "Hypertension"],
             ["Amlodipine 5mg", "Losartan 50mg"],
             {"eGFR": "42 mL/min", "Creatinine": "1.8 mg/dL", "BP": "138/88 mmHg"}, ["Sulfa drugs"]),
            (["Atrial fibrillation", "Hypertension"],
             ["Warfarin 5mg", "Metoprolol 50mg"],
             {"INR": "2.4", "HR": "72 bpm", "BP": "130/80 mmHg"}, []),
            (["Hyperlipidemia"],
             ["Atorvastatin 40mg"],
             {"LDL": "175 mg/dL", "HDL": "45 mg/dL", "Total cholesterol": "240 mg/dL"}, ["Statins — myopathy"]),
            (["Type 2 diabetes", "CKD Stage 3b", "Anemia"],
             ["Metformin 500mg", "Insulin glargine 20 units"],
             {"HbA1c": "9.1 %", "eGFR": "38 mL/min", "Hemoglobin": "10.2 g/dL"}, []),
            (["Hypertension", "Gout"],
             ["Hydrochlorothiazide 25mg", "Allopurinol 300mg"],
             {"BP": "148/94 mmHg", "Uric acid": "8.9 mg/dL"}, ["Aspirin"]),
            (["Type 2 diabetes", "Obesity", "Hypertension"],
             ["Semaglutide 1mg weekly", "Lisinopril 20mg"],
             {"HbA1c": "7.8 %", "BMI": "34.2 kg/m2", "BP": "136/86 mmHg"}, []),
            (["Heart failure", "Hypertension", "Hyperlipidemia"],
             ["Sacubitril/valsartan 97/103mg", "Rosuvastatin 20mg"],
             {"EF": "42 %", "BP": "124/76 mmHg", "LDL": "68 mg/dL"}, []),
            (["Type 2 diabetes", "Peripheral neuropathy"],
             ["Metformin 1000mg", "Gabapentin 300mg"],
             {"HbA1c": "7.5 %", "Vitamin B12": "180 pg/mL"}, ["Contrast dye"]),
        ])
    ]


if __name__ == "__main__":
    main()
