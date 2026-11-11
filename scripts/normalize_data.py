#!/usr/bin/env python3
"""Normalize user-supplied aggregate spreadsheets without inventing current data."""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re

import openpyxl
import xlrd

SCHEMA_VERSION = 1


def clean(value):
    return str(value).replace("\xa0", " ").strip() if value is not None else ""


def numeric(value):
    if value is None or clean(value).lower() in {"", "n/a", "na", "none", "-"}:
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return int(n) if n.is_integer() else n


def key(value):
    return re.sub(r"[^a-z0-9]", "", clean(value).lower())


def get(row, headers, *names):
    for name in names:
        if key(name) in headers:
            return row[headers[key(name)]]
    return None


def identity(value, section=None):
    text = clean(value)
    m = re.match(r"^(MGT)\s*(\d{3,4})(?:\s*[-–]\s*(\d+))?\s*(.*)$", text, re.I)
    if not m:
        return {"courseNumber": None, "section": None, "courseCode": text, "title": text}
    course_number = f"MGT {m[2]}"
    sec = m[3] if m[3] is not None else (clean(section) if section is not None else "")
    if sec:
        sec_n = numeric(sec)
        sec = str(int(sec_n)).zfill(2) if sec_n is not None else sec
    return {"courseNumber": course_number, "section": sec or None,
            "courseCode": course_number + ("-" + sec if sec else ""), "title": m[4] or None}


def term_info(label):
    m = re.search(r"(Fall|Spring|Summer)\s+(\d{2,4})", label, re.I)
    if not m:
        return {"term": label, "season": None, "year": None}
    year = int(m[2])
    year = year + 2000 if year < 100 else year
    return {"term": f"{m[1].title()} {year}", "season": m[1].lower(), "year": year}


def source(path):
    return {"file": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "provenance": "user_uploaded_workbook", "containsStudentIdentifiers": False}


def envelope(path, records, semantics):
    return {"schemaVersion": SCHEMA_VERSION, "source": source(path), "semantics": semantics,
            "recordCount": len(records), "records": records}


def bidding(path):
    book = openpyxl.load_workbook(path, read_only=True, data_only=True)
    records = []
    for sheet in book:
        rows = sheet.iter_rows(values_only=True)
        header = next(rows)
        headers = {key(v): i for i, v in enumerate(header) if v is not None}
        rounds = [(i, clean(v), int(re.search(r"Round\s+(\d+)", clean(v), re.I)[1]))
                  for i, v in enumerate(header) if re.search(r"Round\s+\d+", clean(v), re.I)]
        for rn, row in enumerate(rows, 2):
            course = get(row, headers, "Course")
            if not clean(course):
                continue
            terms = term_info(sheet.title)
            flags = ["term_label_anomaly"] if terms["year"] == 2000 else []
            item = {"id": f"bid:{sheet.title}:{rn}", **terms, **identity(course),
                    "type": clean(get(row, headers, "Type")) or None,
                    "seats": numeric(get(row, headers, "Seats")),
                    "open": numeric(get(row, headers, "Open")),
                    "rounds": [], "qualityFlags": flags,
                    "sourceSheet": sheet.title, "sourceRow": rn}
            for i, label, number in rounds:
                raw = row[i] if i < len(row) else None
                value = numeric(raw)
                metric = "clearing_price" if "clearing price" in label.lower() else "reported_round_value"
                item["rounds"].append({"round": number, "label": label, "value": value,
                                       "rawValue": raw, "metric": metric})
            item["courseTitleKey"] = key(item["title"])
            records.append(item)
    duplicates = Counter((r["term"], r["courseCode"]) for r in records)
    titles_by_number = {}
    for r in records:
        if r["courseNumber"]:
            titles_by_number.setdefault(r["courseNumber"], set()).add(r["courseTitleKey"])
    for r in records:
        if duplicates[(r["term"], r["courseCode"])] > 1:
            r["qualityFlags"].append("duplicate_course_section_term")
        if len(titles_by_number.get(r["courseNumber"], set())) > 1:
            r["qualityFlags"].append("course_number_has_multiple_titles")
    return envelope(path, records, {
        "unit": "historical_reported_points", "isIndividualBidData": False,
        "missingIsZero": False, "zeroGuaranteesFreeEnrollment": False,
        "roundsWithClearingPriceLabel": "historical clearing price as explicitly labeled",
        "roundsWithoutClearingPriceLabel": "reported round value; column meaning needs confirmation",
        "warning": "Historical aggregates, not success probabilities or current auction rules. Match course title as well as code before comparing; codes are reused for different courses. Round-specific GSR labels are retained. Anomalous 2000 sheet labels are not corrected."
    })


def exchange(path):
    records = []
    for sheet in openpyxl.load_workbook(path, read_only=True, data_only=True):
        rows = sheet.iter_rows(values_only=True)
        header = next(rows)
        for rn, row in enumerate(rows, 2):
            if not clean(row[0]):
                continue
            records.append({"id": f"exchange:{sheet.title}:{rn}", "program": clean(row[0]),
                            "academicYear": "2025-2026", "sourceSheet": sheet.title, "sourceRow": rn,
                            "rounds": [{"round": i, "label": clean(header[i]), "value": numeric(row[i]),
                                        "metric": "clearing_price"} for i in range(1, len(header))]})
    return envelope(path, records, {"scope": "international_exchange_only",
        "warning": "Do not merge exchange destination prices with elective course bids or assume the same budget."})


def enrollment(path):
    book = xlrd.open_workbook(path)
    records = []
    for sheet in book.sheets():
        header = sheet.row_values(0)
        headers = {key(v): i for i, v in enumerate(header) if v is not None}
        for rn in range(1, sheet.nrows):
            row = sheet.row_values(rn)
            course = get(row, headers, "CourseNumber", "Course")
            if not re.match(r"^MGT\s*\d+", clean(course), re.I):
                continue
            total = get(row, headers, "Total Enrollment", "Total Enrolled", "Total Enrolled under YSOM #",
                        "Total Enrolled under MGT #", "Enrolled under YSOM #")
            item = {"id": f"enrollment:{sheet.name}:{rn+1}", **term_info(sheet.name),
                    **identity(course, get(row, headers, "Section", "Sec")),
                    "title": clean(get(row, headers, "CourseTitle", "Course Title")),
                    "session": clean(get(row, headers, "CourseSession", "Session")) or None,
                    "instructor": clean(get(row, headers, "Instructor", "Instructor_LN", "Instructor Last Name")) or None,
                    "units": numeric(get(row, headers, "Units")),
                    "enrolledUnderSom": numeric(get(row, headers, "Enrolled under YSOM #", "Total Enrolled under YSOM #", "Total Enrolled under MGT #", "Total Enrolled")),
                    "enrolledUnderCrossList": numeric(get(row, headers, "Enrolled under Cross-List #s")),
                    "totalEnrolled": numeric(total),
                    "totalMetric": "all_cross_lists" if key("Total Enrollment") in headers else "som_or_legacy_total",
                    "enrollmentLimit": numeric(get(row, headers, "YSOM Enrollment Limit", "Enrollment Limit")),
                    "sourceSheet": sheet.name, "sourceRow": rn+1}
            item["courseTitleKey"] = key(item["title"])
            records.append(item)
    return envelope(path, records, {"scope": "historical_aggregate_enrollment",
        "containsMeetingTimes": False, "isEligibilityEvidence": False,
        "warning": "Different years use SOM-only versus all-cross-list totals. Limits are historical and need not equal current available seats. Units and instructors apply only to the recorded term."})


def nonsom(path):
    sheet = openpyxl.load_workbook(path, read_only=True, data_only=True).active
    rows = list(sheet.values)
    programs = [clean(v) for v in rows[1][1:]]
    term = None
    records = []
    for rn, row in enumerate(rows[2:], 3):
        label = clean(row[0])
        if re.fullmatch(r"(?:Fall|Spring|Summer) \d{4}", label):
            term = label
            continue
        if not term or not re.match(r"^[A-Z& ]+\s+\d+[A-Za-z]?\s*,", label):
            continue
        code, title = label.split(",", 1)
        records.append({"id": f"nonsom:{rn}", **term_info(term), "courseCode": code.strip(),
                        "title": title.strip(), "programCounts": {p: numeric(v) for p, v in zip(programs, row[1:])},
                        "sourceSheet": sheet.title, "sourceRow": rn})
    return envelope(path, records, {"scope": "historical_som_participation_in_nonsom_courses",
        "isCurrentCatalog": False, "isEligibilityEvidence": False,
        "warning": "Historical participation counts do not imply current availability, permission to enroll, or review quality. Blank counts remain null."})


def validate(products):
    bids = products["bidding-history.json"]["records"]
    assert bids and any(round_["value"] == 0 for r in bids for round_ in r["rounds"])
    assert any(round_["value"] is None for r in bids for round_ in r["rounds"])
    assert all(len({r["id"] for r in product["records"]}) == len(product["records"]) for product in products.values())
    assert all(r["qualityFlags"] for r in bids if r["year"] == 2000)
    assert all(round_["value"] is None or round_["value"] >= 0 for r in bids for round_ in r["rounds"])
    assert len(products["exchange-history.json"]["records"]) == 7
    assert products["exchange-history.json"]["semantics"]["scope"] == "international_exchange_only"
    assert max(r["year"] for r in products["enrollment-history.json"]["records"]) == 2026
    assert not products["enrollment-history.json"]["semantics"]["containsMeetingTimes"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("data"))
    args = parser.parse_args()
    products = {
        "bidding-history.json": bidding(args.input_dir / "Auction-Bidding-History.xlsx"),
        "enrollment-history.json": enrollment(args.input_dir / "Enrollment-History.xls"),
        "exchange-history.json": exchange(args.input_dir / "International-Exchange-Bidding-History.xlsx"),
        "nonsom-history.json": nonsom(args.input_dir / "SOM Students in NonSOM Courses for Portal.xlsx"),
    }
    validate(products)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for name, product in products.items():
        (args.output_dir / name).write_text(json.dumps(product, ensure_ascii=False, separators=(",", ":")) + "\n")
    audit = {"schemaVersion": 1, "generatedFrom": "user_uploaded_workbooks", "validation": "passed",
             "datasets": [{"path": name, "recordCount": p["recordCount"], "source": p["source"]} for name, p in products.items()],
             "auctionAnomalies": {"termLabels": sorted({r["sourceSheet"] for r in products["bidding-history.json"]["records"] if "term_label_anomaly" in r["qualityFlags"]}),
                                  "duplicateRows": sum("duplicate_course_section_term" in r["qualityFlags"] for r in products["bidding-history.json"]["records"])}}
    (args.output_dir / "data-audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
