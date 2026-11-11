#!/usr/bin/env python3
"""Fetch the public SOM catalogue, without authentication or paid services.

Usage: python3 scripts/fetch_catalog.py [--term 202701] [--output data/catalog.json]

This endpoint is the official public directory's read-only POST data source.
It does not submit enrollment or auction bids. Student reviews remain manually
curated in data/reviews.json; this script neither fetches nor modifies them.
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
from html.parser import HTMLParser
import math
import os
from pathlib import Path
import re
import tempfile
import urllib.error
import urllib.request
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
DIRECTORY_URL = "https://som.yale.edu/elective-core-courses"
DAY_NUMBERS = {"M": 1, "T": 2, "W": 3, "Th": 4, "F": 5}
SESSIONS = {
    "spring": "FULL", "spring-1": "S1", "spring-2": "S2",
    "fall": "FULL", "fall-1": "S1", "fall-2": "S2",
}
DEFAULT_USER_RULES = {
    "budget": {"mode": "user_input", "source": "user_provided", "officiallyVerified": False},
    "unsuccessfulBidRefund": {"value": True, "source": "user_provided", "officiallyVerified": False},
    "courseWithdrawalRefund": {"value": None, "source": "unknown"},
    "legalPointIncrement": None, "tieBreaking": None,
    "allocationAndCharging": None, "roundDates": None,
}

class _DescriptionText(HTMLParser):
    """Keep readable paragraph/list structure while never emitting active HTML."""

    BLOCKS = {"p", "div", "section", "article", "li", "ul", "ol", "blockquote", "h1", "h2", "h3", "h4", "table", "tr"}
    SKIP = {"script", "style", "template", "head", "noscript"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skipping = 0

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag in self.SKIP:
            self.skipping += 1
        elif not self.skipping and tag in self.BLOCKS | {"br"}:
            self.parts.append("\n\n" if tag in self.BLOCKS else "\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.SKIP and self.skipping:
            self.skipping -= 1
        elif not self.skipping and tag in self.BLOCKS:
            self.parts.append("\n\n")

    def handle_data(self, data: str) -> None:
        if not self.skipping:
            self.parts.append(data)


def plain_text(value: object) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    parser = _DescriptionText()
    parser.feed(value.replace("\r\n", "\n").replace("\r", "\n"))
    parser.close()
    text = "".join(parser.parts).replace("\xa0", " ")
    text = "\n".join(re.sub(r"[ \t\f\v]+", " ", line).strip() for line in text.split("\n"))
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text or None


def safe_url(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    parsed = urlsplit(value)
    return value if parsed.scheme in {"http", "https"} and parsed.netloc else None


def excerpt(text: str | None, limit: int = 220) -> str | None:
    if not text or len(text) <= limit:
        return text
    # A direct extract, never an invented translation or model paraphrase.
    cut = text[:limit].rsplit(" ", 1)[0].rstrip()
    return cut + "…"


def parse_yes_no(value: object) -> bool | None:
    normalized = str(value).strip().casefold()
    return {"yes": True, "no": False}.get(normalized)


def parse_number(value: object) -> float | None:
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def parse_date(value: object) -> str | None:
    match = re.match(r"^(\d{8})(?:\s|$)", str(value or ""))
    if not match or match[1].startswith("1900"):
        return None
    try:
        return dt.datetime.strptime(match[1], "%Y%m%d").date().isoformat()
    except ValueError:
        return None


def parse_clock(value: object) -> str | None:
    match = re.fullmatch(r"(\d{2}):(\d{2})(?::(\d{2}))?", str(value or "").strip())
    if not match:
        return None
    hour, minute, second = (int(part or 0) for part in match.groups())
    if hour > 23 or minute > 59 or second != 0:
        return None
    return f"{hour:02d}:{minute:02d}"


def normalize_course(row: dict, source_url: str) -> dict:
    code = str(row["courseNumber"])
    section, term = str(row["section"]), str(row["termCode"])
    day_tokens = str(row.get("day") or "").split()
    start, end = parse_clock(row.get("startTime")), parse_clock(row.get("endTime"))
    known = bool(day_tokens) and all(day in DAY_NUMBERS for day in day_tokens)
    known = bool(known and start and end and start < end)
    # S is ambiguous (Saturday/Sunday), so it deliberately remains unscheduled.
    meetings = [{"days": [DAY_NUMBERS[day] for day in day_tokens], "start": start, "end": end}] if known else []
    title = str(row["courseTitle"])
    description = plain_text(row.get("courseDescription"))
    session = SESSIONS.get(str(row.get("courseSession", "")).casefold())
    if session is None:
        raise ValueError(f"Unknown course session for {code}-{section}")
    return {
        "id": code.replace(" ", "") + "-" + section + "-" + term,
        "sourceCourseId": str(row["courseID"]), "code": code,
        "section": section, "title": title, "termCode": term,
        "session": session,
        "startDate": parse_date(row.get("courseSessionStartDate")),
        "endDate": parse_date(row.get("courseSessionEndDate")),
        "credits": parse_number(row.get("units")),
        "faculty": [row[key] for key in ("faculty1", "faculty2", "faculty3", "faculty4") if row.get(key)],
        "categories": [row[key] for key in ("courseCategory", "courseCategory2", "courseCategory3", "courseCategory4") if row.get(key)],
        "meetings": meetings, "daysTimes": row.get("daysTimes") or None,
        "rawDay": row.get("day") or None,
        "capacity": parse_number(row.get("enrollmentLimit")), "availableSeats": None,
        "bidAllowed": parse_yes_no(row.get("allowBid")),
        "bidOrPermission": row.get("bidOrPermission") or None,
        "prerequisite": plain_text(row.get("prerequisite")),
        "room": plain_text(row.get("room")),
        "courseAttributes": [part.strip() for part in str(row.get("courseAttributes") or "").split("|") if part.strip()],
        "cohort": plain_text(row.get("cohort")),
        "programTags": str(row.get("courseType") or "").split("|") if row.get("courseType") else [],
        "syllabusUrl": safe_url(row.get("syllabus")),
        "oldSyllabusUrl": safe_url(row.get("oldSyllabus")),
        "isNew": row.get("newCourse") == "New", "eligibilityVerified": False,
        "sourceUrl": source_url, "directoryUrl": DIRECTORY_URL,
        "description": description, "descriptionPreview": excerpt(description),
        "descriptionSource": "official_catalog" if description else None,
        "descriptionSourceUrl": source_url if description else None,
        "summary": excerpt(description),
        "summaryType": "official_description_excerpt" if description else None,
        "timingStatus": "known_regular_slots" if known else "unknown_or_ambiguous",
    }


def fetch_catalog(term: str, timeout: float, previous_metadata: dict) -> dict:
    source_url = f"https://som.yale.edu/courses/session-items/{term}"
    request = urllib.request.Request(source_url, data=b"{}", method="POST", headers={"Content-Type": "application/json"})
    # urllib honors the environment proxy and CA settings; no credentials needed.
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read(10 * 1024 * 1024 + 1)
    if len(body) > 10 * 1024 * 1024:
        raise ValueError("Official catalogue response exceeded 10 MiB")
    raw = json.loads(body)
    rows = raw.get("data", {}).get("items")
    if not isinstance(rows, list) or not rows:
        raise ValueError("Official response has no course items; existing output left unchanged")
    courses = [normalize_course(row, source_url) for row in rows]
    if len({course["id"] for course in courses}) != len(courses):
        raise ValueError("Duplicate course/section/term identities; existing output left unchanged")
    if any(course["termCode"] != term for course in courses):
        raise ValueError("Returned term differs from requested term; existing output left unchanged")
    missing = sum(not row.get("day") or not row.get("startTime") or not row.get("endTime") for row in rows)
    unknown = sum(not course["meetings"] for course in courses)
    season = {"01": "Spring", "02": "Summer", "03": "Fall"}.get(term[-2:])
    return {
        "metadata": {
            "schemaVersion": 1, "retrievedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "responseTimestamp": raw.get("dateTimeStamp"), "sourceUrl": source_url,
            "sourceMethod": "POST", "sourceBody": {}, "discoveryUrl": DIRECTORY_URL,
            "termCode": term, "termLabel": f"{season} {term[:4]}" if season else term,
            "recordCount": len(courses), "timezone": "America/New_York",
            "limitations": [
                "Official public catalogue snapshot, not live enrollment or an auction submission endpoint.",
                f"{len(courses)} records include PhD, core, EMBA, program-specific and elective classes; not all are open to every SOM student.",
                "Program tags and bid permission do not establish an individual student's eligibility.",
                "Capacity is a course limit, not currently available seats.",
                "Regular slots omit holidays, required retreats, lab/group assignments and other special meetings unless separately confirmed.",
                f"{missing} records omit regular meeting information; {unknown - missing} additional records have ambiguous or invalid slots and remain unscheduled.",
                "Budget is user-entered and unsuccessful bids are refunded according to the user; these rules are not independently verified from official documentation. Legal point increments, allocation, ties, round dates and course-withdrawal refunds remain unknown.",
                "Course descriptions are official catalogue text, normalized to safe plain text with paragraph structure. Previews are direct English extracts, not translations or a substitute for the current syllabus.",
                "The user-facing official link opens the readable course directory. The POST JSON URL is separately labelled as a technical data source. Old syllabus links are historical material, not current syllabi.",
                "MGT course numbers are reused across years for different subjects. Historical bids must match normalized title, term and round as well as code; do not attach old MGT 651/652 or unrelated 554/561 records to new 2027 courses. Alias mappings require explicit evidence, not fuzzy similarity alone.",
            ],
            "descriptionCoverage": {"provided": sum(bool(course["description"]) for course in courses), "missing": sum(not course["description"] for course in courses), "method": "official courseDescription normalized to plain text; preview is a direct extract"},
            "auctionRuleStatus": copy.deepcopy(previous_metadata.get("auctionRuleStatus", DEFAULT_USER_RULES)),
            "bidPermissionNormalization": {
                "method": "trim and lowercase raw allowBid; yes=true, no=false, otherwise=null",
                "trueCount": sum(course["bidAllowed"] is True for course in courses),
                "falseCount": sum(course["bidAllowed"] is False for course in courses),
                "unknownCount": sum(course["bidAllowed"] is None for course in courses),
            },
        },
        "courses": courses,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--term", default="202701", help="Official six-digit term code, default 202701")
    parser.add_argument("--output", type=Path, default=ROOT / "data/catalog.json")
    parser.add_argument("--timeout", type=float, default=30, help="Request timeout in seconds")
    args = parser.parse_args()
    if not re.fullmatch(r"\d{6}", args.term):
        parser.error("--term must be a six-digit official term code")
    previous = {}
    if args.output.exists():
        previous = json.loads(args.output.read_text(encoding="utf-8")).get("metadata", {})
    try:
        catalog = fetch_catalog(args.term, args.timeout, previous)
    except (OSError, ValueError, KeyError, TypeError, urllib.error.URLError) as error:
        parser.exit(1, f"Catalogue fetch failed; output was not replaced: {error}\n")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Failure never truncates the previous snapshot; installation is atomic.
    temporary = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=args.output.parent, delete=False) as handle:
            temporary = handle.name
            json.dump(catalog, handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.write("\n")
        os.replace(temporary, args.output)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)
    counts = catalog["metadata"]["bidPermissionNormalization"]
    print(json.dumps({"output": str(args.output), "term": args.term, "records": len(catalog["courses"]), "bidAllowed": {"true": counts["trueCount"], "false": counts["falseCount"], "unknown": counts["unknownCount"]}, "unknownMeetings": sum(not course["meetings"] for course in catalog["courses"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
