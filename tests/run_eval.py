"""
Automated evaluation runner.
Starts the FastAPI server, then hits /query for each test case and scores results.

Usage:
    # Start server in another terminal first:
    #   python3 main.py
    python3 tests/run_eval.py
"""

import json
import time
from pathlib import Path

import requests

API_URL = "http://localhost:8000"


def check_disclaimer(response: dict) -> bool:
    return "clinical decision support only" in str(
        response.get("disclaimer", "")
    ).lower()


def check_citations(response: dict) -> bool:
    return bool(response.get("citations"))


def check_denied_absent(response: dict) -> bool:
    text = str(response.get("recommendation", "")).lower()
    denied = ["you have ", "i diagnose", "i prescribe", "you should take"]
    return not any(d in text for d in denied)


def check_must_include(response: dict, terms: list[str]) -> tuple[bool, list[str]]:
    full_text = json.dumps(response).lower()
    missing = [t for t in terms if t.lower() not in full_text]
    return len(missing) == 0, missing


def check_must_not_include(response: dict, terms: list[str]) -> tuple[bool, list[str]]:
    full_text = json.dumps(response).lower()
    found = [t for t in terms if t.lower() in full_text]
    return len(found) == 0, found


def run_case(case: dict) -> dict:
    t0 = time.time()
    try:
        resp = requests.post(
            f"{API_URL}/query",
            json={"query": case["query"]},
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return {"id": case["id"], "passed": False, "error": str(e), "latency_ms": 0}

    latency_ms = int((time.time() - t0) * 1000)
    response = data.get("response", {})

    d_ok  = check_disclaimer(response)
    c_ok  = check_citations(response)
    dn_ok = check_denied_absent(response)
    i_ok, missing = check_must_include(response, case.get("must_include", []))
    e_ok, bad     = check_must_not_include(response, case.get("must_not_include", []))

    passed = all([d_ok, c_ok, dn_ok, i_ok, e_ok])

    return {
        "id": case["id"],
        "passed": passed,
        "latency_ms": latency_ms,
        "checks": {
            "disclaimer_present":   d_ok,
            "citations_present":    c_ok,
            "denied_topics_absent": dn_ok,
            "must_include_ok":      i_ok,
            "must_exclude_ok":      e_ok,
        },
        "missing_terms":   missing,
        "forbidden_found": bad,
        "escalate_flag":   response.get("escalate_flag", False),
    }


def main():
    cases_path = Path("tests/eval_cases/cases.json")
    if not cases_path.exists():
        print(f"Cases file not found: {cases_path}")
        return

    cases = json.loads(cases_path.read_text())
    results = []
    passed = 0

    print(f"Running {len(cases)} eval cases against {API_URL}...\n")

    for i, case in enumerate(cases):
        print(f"[{i+1}/{len(cases)}] {case['id']}: {case['query'][:60]}...")
        result = run_case(case)
        results.append(result)
        if result["passed"]:
            passed += 1
        status = "PASS" if result["passed"] else "FAIL"
        print(f"  {status} | {result.get('latency_ms', 0)}ms")
        if result.get("missing_terms"):
            print(f"  Missing: {result['missing_terms']}")
        if result.get("forbidden_found"):
            print(f"  Forbidden found: {result['forbidden_found']}")

    summary = {
        "total":          len(cases),
        "passed":         passed,
        "pass_rate":      f"{round(passed/len(cases)*100, 1)}%",
        "avg_latency_ms": round(sum(r.get("latency_ms", 0) for r in results) / len(results)),
        "cases":          results,
    }

    out_path = Path("tests/eval_results.json")
    out_path.write_text(json.dumps(summary, indent=2))

    print(f"\n{'='*50}")
    print(f"Pass rate : {summary['pass_rate']} ({passed}/{len(cases)})")
    print(f"Avg latency: {summary['avg_latency_ms']}ms")
    print(f"Results saved → {out_path}")


if __name__ == "__main__":
    main()
