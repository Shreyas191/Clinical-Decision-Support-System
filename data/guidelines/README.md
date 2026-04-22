# Clinical Guidelines

Add PDF files to this folder before running `vectorstore/ingest.py`.

## Recommended free PDFs

| Source | URL | Condition |
|--------|-----|-----------|
| ADA 2024 Standards of Care | https://diabetesjournals.org/care/issue/47/Supplement_1 | Diabetes |
| ACC/AHA 2023 Hypertension | https://www.ahajournals.org/doi/10.1161/HYP.0000000000000065 | Hypertension |
| NICE NG28 (Type 2 diabetes) | https://www.nice.org.uk/guidance/ng28 | Diabetes |
| ACC/AHA Cholesterol 2019 | https://www.ahajournals.org/doi/10.1161/CIR.0000000000000625 | Lipids |
| KDIGO CKD Guidelines | https://kdigo.org/guidelines/ckd-evaluation-and-management/ | CKD |

## Naming convention

`{source}_{year}_{condition}.pdf`

Examples:
- `ADA_2024_diabetes.pdf`
- `ACC_AHA_2023_hypertension.pdf`
- `NICE_NG28_type2_diabetes.pdf`

The ingestion pipeline will add the filename as metadata to every chunk,
so citations returned by the agent will reference your file names.

## Without PDFs

The system still works without PDFs — the drug and patient collections
will load fine. The GuidelinesAgent will simply return fewer results.
