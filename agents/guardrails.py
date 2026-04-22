import re

DENIED_PATTERNS = [
    r"diagnose me",
    r"\bi have (?:cancer|diabetes|hiv|disease)\b",
    r"\bprescribe\b",
    r"write me a prescription",
    r"\d{3}-\d{2}-\d{4}",    # SSN pattern
    r"MRN[:\s]\d+",           # Medical record number
    r"date of birth[:\s]\d",  # DOB
]

DISCLAIMER = (
    "This information is for clinical decision support only. "
    "Final clinical decisions rest with the treating clinician."
)

DENIED_OUTPUT_PHRASES = [
    "you have ",
    "i diagnose",
    "i prescribe",
    "take this medication",
    "you should take",
    "you must take",
]


def check_input(query: str) -> dict:
    """
    Run before the graph. Returns safe=False if the query contains
    PHI patterns, direct diagnosis requests, or prescription requests.
    """
    for pattern in DENIED_PATTERNS:
        if re.search(pattern, query, re.IGNORECASE):
            return {
                "safe": False,
                "reason": (
                    "Query contains restricted content (PHI, direct diagnosis "
                    "request, or prescription request). Please rephrase as a "
                    "clinical information query."
                ),
                "sanitized_query": "",
            }
    return {"safe": True, "reason": "", "sanitized_query": query.strip()}


def validate_output(response: dict) -> bool:
    """
    Run after synthesis. Returns False if the response:
    - is missing the disclaimer
    - contains direct diagnosis/prescription language
    - has no citations
    """
    disclaimer_ok = DISCLAIMER.lower() in str(
        response.get("disclaimer", "")
    ).lower()

    text = str(response.get("recommendation", "")).lower()
    denied_ok = not any(p in text for p in DENIED_OUTPUT_PHRASES)

    citations_ok = bool(response.get("citations"))

    return disclaimer_ok and denied_ok and citations_ok
