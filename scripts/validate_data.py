#!/usr/bin/env python3
"""Checks real workbook preservation and important semantic boundaries."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(name):
    return json.loads((ROOT / "data" / name).read_text())


def main():
    audit = read("data-audit.json")
    for info in audit["datasets"]:
        path = ROOT / "data" / "raw" / info["source"]["file"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == info["source"]["sha256"], path
        data = read(info["path"])
        assert len(data["records"]) == info["recordCount"]
    bids = read("bidding-history.json")["records"]
    latest = [r for r in bids if r["term"] == "Spring 2026" and r["courseCode"] == "MGT 554-01"]
    assert len(latest) == 1
    assert [r["value"] for r in latest[0]["rounds"]] == [5, 300, 261]
    assert all(r["metric"] == "reported_round_value" for r in latest[0]["rounds"])
    assert len({r["courseTitleKey"] for r in bids if r["courseNumber"] == "MGT 554"}) == 2
    assert {r["title"] for r in bids if r["courseNumber"] == "MGT 651"} == {"Innovation and Reform in the Delivery of Legal Services"}
    assert any(r["metric"] == "clearing_price" for item in bids for r in item["rounds"])
    assert any(r["value"] == 0 for item in bids for r in item["rounds"])
    assert any(r["value"] is None for item in bids for r in item["rounds"])
    anomalies = [r for r in bids if r["year"] == 2000]
    assert anomalies and all("term_label_anomaly" in r["qualityFlags"] for r in anomalies)
    duplicated = [r for r in bids if "duplicate_course_section_term" in r["qualityFlags"]]
    assert len(duplicated) == 8
    assert read("exchange-history.json")["semantics"]["scope"] == "international_exchange_only"
    assert not read("nonsom-history.json")["semantics"]["isEligibilityEvidence"]
    enrollment = read("enrollment-history.json")
    assert not enrollment["semantics"]["containsMeetingTimes"]
    assert max(r["year"] for r in enrollment["records"]) == 2026
    print("PASS: source hashes, record counts, real 554 values, code reuse, zero/null, round semantics, anomalies and separate scopes")


if __name__ == "__main__":
    main()
