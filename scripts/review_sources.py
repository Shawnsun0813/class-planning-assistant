#!/usr/bin/env python3
"""Validate source coverage, recheck public evidence, or normalize local reviews.

No credentials, CAS submissions, authentication challenges, hidden API scraping,
or paid services are used. Source links never count as imported review records.
Restricted imports are written outside this public repository only.
"""

from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import datetime as dt
import hashlib
from html.parser import HTMLParser
import json
import math
import os
from pathlib import Path
import re
import tempfile
from urllib import error, parse, request

ROOT = Path(__file__).resolve().parents[1]
REVIEWS = ROOT / "data/reviews.json"
SOURCES = ROOT / "data/review-sources.json"
CATALOG = ROOT / "data/catalog.json"
ALLOWED_HOSTS = {
    "som.yale.edu", "fraxinus1098.substack.com", "poetsandquants.com",
    "oce.app.yale.edu", "secure.its.yale.edu", "www.coursicle.com",
    "coursetable.com", "api.coursetable.com", "www.ratemyprofessors.com",
    "www.mysomclasses.com", "somshortcut.com", "catalog.yale.edu",
}
MATERIAL_KINDS = {
    "independent_course_review", "alumni_testimonial", "preference_only",
    "background_only", "official_evaluation", "user_supplied_experience",
}
MARKERS = {
    "ash-2025-mgt554": ["AI for Business Decisions", "Tong Wang", "quizzes"],
    "ash-2025-mgt531": ["Interpersonal Dynamics", "David Tate", "emotional"],
    "ash-2025-mgt858": ["Database Systems", "SQL", "quizzes"],
    "ash-2025-mgt623": ["Strategic Leadership Across Sectors", "Sonnenfeld"],
    "andrea-2025-mgt561": ["Product Management", "KPI", "Andrea Pacheco"],
    "erin-2024-mgt531": ["Interpersonal", "Heidi Brooks", "Erin Manning"],
    "edirin-2019-mgt531": ["Interpersonal Dynamics", "Favorite Yale SOM class"],
    "luisa-2025-mgt561-context": ["Product Management", "TA for the class"],
}


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile("w", dir=path.parent, encoding="utf-8", delete=False) as handle:
            temporary = handle.name
            json.dump(data, handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def key(code: str, title: str) -> tuple[str, str]:
    # Only case and whitespace normalization, never fuzzy course-number matches.
    return re.sub(r"\s+", " ", code).strip().casefold(), re.sub(r"\s+", " ", title).strip().casefold()


def person_key(name: str) -> tuple[str, ...]:
    # Name order and middle initials may differ, but do not fuzzy-match people.
    return tuple(sorted(word for word in re.findall(r"[^\W\d_]+", name.casefold()) if len(word) > 1))


class VisibleText(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.hidden = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag in ("script", "style"):
            self.hidden += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style"):
            self.hidden = max(0, self.hidden - 1)

    def handle_data(self, data: str) -> None:
        if not self.hidden:
            self.parts.append(data)


def fetch_visible(url: str) -> dict:
    if parse.urlsplit(url).scheme != "https" or parse.urlsplit(url).hostname not in ALLOWED_HOSTS:
        raise ValueError("URL is outside the audited HTTPS source allowlist")
    result = {"url": url, "checkedAt": now()}
    try:
        with request.urlopen(url, timeout=20) as response:
            raw = response.read(4 * 1024 * 1024 + 1)
            result.update(httpStatus=response.status, finalUrl=response.url)
        if len(raw) > 4 * 1024 * 1024:
            return {**result, "status": "response_too_large"}
        if parse.urlsplit(result["finalUrl"]).hostname == "secure.its.yale.edu":
            return {**result, "status": "authentication_required"}
        parser = VisibleText()
        parser.feed(raw.decode("utf-8", errors="replace"))
        return {**result, "status": "page_read", "text": " ".join(parser.parts), "sha256": hashlib.sha256(raw).hexdigest()}
    except error.HTTPError as exc:
        return {**result, "httpStatus": exc.code, "status": "access_limited"}
    except (OSError, error.URLError) as exc:
        # Save only a safe error class; no cookies, headers or HTML/login bodies.
        return {**result, "status": "transport_unavailable", "errorType": type(exc).__name__}


def rebuild_registry() -> dict:
    reviews, registry, catalog = load(REVIEWS), load(SOURCES), load(CATALOG)
    rows = reviews["reviews"]
    kinds = Counter(row["materialKind"] for row in rows)
    reviews["metadata"].update(reviewCount=len(rows), classificationCounts=dict(kinds))
    metadata = registry["metadata"]
    metadata.update(
        checkedAt=now(), sourceCount=len(registry["sources"]), materialCount=len(rows),
        courseCoverage=len({key(row["courseCode"], row["courseTitle"]) for row in rows}),
        independentCourseReviewCount=kinds["independent_course_review"],
        independentReviewAuthors=len({row["author"] for row in rows if row["materialKind"] == "independent_course_review"}),
        substantiveAlumniTestimonialCount=kinds["alumni_testimonial"],
        preferenceOnlyCount=kinds["preference_only"], backgroundOnlyCount=kinds["background_only"],
        authenticatedEvaluationCount=0,
    )
    entries: dict[str, dict] = {}
    prior = {row["courseKey"]: row for row in registry["courseSources"]}
    for course in catalog["courses"]:
        identity = course["code"] + "|" + course["title"] + "|" + course["termCode"]
        entry = entries.setdefault(identity, {
            "courseKey": identity, "courseCode": course["code"], "courseTitle": course["title"],
            "termCode": course["termCode"], "courseIds": [], "reviewIds": [], "contextIds": [],
            "links": prior.get(identity, {}).get("links", []),
        })
        entry["courseIds"].append(course["id"])
    for entry in entries.values():
        matching = [row for row in rows if key(row["courseCode"], row["courseTitle"]) == key(entry["courseCode"], entry["courseTitle"])]
        entry["reviewIds"] = [row["id"] for row in matching if row["materialKind"] in ("independent_course_review", "alumni_testimonial", "official_evaluation", "user_supplied_experience")]
        entry["contextIds"] = [row["id"] for row in matching if row["materialKind"] in ("preference_only", "background_only")]
        faculty = {person_key(name) for course in catalog["courses"] if course["id"] in entry["courseIds"] for name in course["faculty"]}
        entry["reviewMatches"] = []
        for row in matching:
            historical_faculty = {person_key(name) for name in row.get("faculty", [])}
            teacher_state = "unknown" if not historical_faculty else "matches_current_teacher" if faculty & historical_faculty else "different_teacher"
            entry["reviewMatches"].append({"reviewId": row["id"], "scope": "historical_material_not_current_term_evaluation", "teacherState": teacher_state, "sourceTerm": row.get("term"), "sourceFaculty": row.get("faculty", []), "currentTermVerified": False})
    registry["courseSources"] = list(entries.values())
    write(REVIEWS, reviews)
    write(SOURCES, registry)
    return metadata


def validate() -> dict:
    data, registry, catalog = load(REVIEWS), load(SOURCES), load(CATALOG)
    rows = data["reviews"]
    ids = {row["id"] for row in rows}
    by_id = {row["id"]: row for row in rows}
    if len(ids) != len(rows):
        raise ValueError("Duplicate material IDs")
    source_ids = {source["id"] for source in registry["sources"]}
    courses = {course["id"]: course for course in catalog["courses"]}
    for row in rows:
        if row["sourceId"] not in source_ids or row["materialKind"] not in MATERIAL_KINDS:
            raise ValueError("Unknown source or material kind")
        if row["accessScope"] != "public":
            raise ValueError("Restricted material must not be in this public repository")
    linked = set()
    for entry in registry["courseSources"]:
        if not set(entry["reviewIds"] + entry["contextIds"]) <= ids:
            raise ValueError("Source registry contains missing material IDs")
        for material_id in entry["reviewIds"] + entry["contextIds"]:
            material = by_id[material_id]
            if key(material["courseCode"], material["courseTitle"]) != key(entry["courseCode"], entry["courseTitle"]):
                raise ValueError("Source registry links same-code/different-title material")
        for course_id in entry["courseIds"]:
            course = courses.get(course_id)
            if course is None or key(course["code"], course["title"]) != key(entry["courseCode"], entry["courseTitle"]) or course["termCode"] != entry["termCode"]:
                raise ValueError("Source registry course identity mismatch")
            linked.add(course_id)
    if linked != set(courses):
        raise ValueError("Not every current catalogue section has a source-state entry")
    return {"valid": True, "materials": len(rows), "courseCoverage": len({key(row["courseCode"], row["courseTitle"]) for row in rows}), "sourceStates": len(source_ids), "courseSections": len(linked), "authenticatedSOMEvaluations": 0}


def verify_public(ids: list[str] | None) -> dict:
    data = load(REVIEWS)
    rows = [row for row in data["reviews"] if not ids or row["id"] in ids]
    urls = sorted({row["sourceUrl"] for row in rows})
    with ThreadPoolExecutor(max_workers=4) as pool:
        pages = dict(zip(urls, pool.map(fetch_visible, urls)))
    counts = Counter()
    for row in rows:
        page = pages[row["sourceUrl"]]
        expected = MARKERS.get(row["id"], [])
        visible = re.sub(r"\s+", " ", page.get("text", "")).casefold()
        found = [marker for marker in expected if marker.casefold() in visible]
        passed = page["status"] == "page_read" and bool(expected) and len(found) == len(expected)
        state = "public_source_content_verified" if passed else page["status"] if page["status"] != "page_read" else "content_markers_not_verified"
        row.setdefault("sourceChecks", {})["latestHttpCheck"] = {k: value for k, value in page.items() if k != "text"}
        row["sourceChecks"]["latestHttpCheck"].update(status=state, expectedMarkers=expected, matchedMarkers=found)
        counts[state] += 1
    # Keep previous curated text even if a publisher is temporarily inaccessible.
    # A failed check is recorded, never converted into a fabricated new review.
    write(REVIEWS, data)
    rebuild_registry()
    return {"checkedMaterials": len(rows), "states": dict(counts), "storedFullArticles": False}


def normalize_import(payload: dict, catalog: dict) -> dict:
    if not isinstance(payload, dict) or not isinstance(payload.get("reviews"), list):
        raise ValueError("Input must be a JSON object with a reviews array, not a raw website export")
    if not payload["reviews"]:
        raise ValueError("Input contains no review records")
    current = {key(course["code"], course["title"]) for course in catalog["courses"]}
    result = []
    seen = set()
    for row in payload["reviews"]:
        for field in ("id", "courseCode", "courseTitle", "title", "sourceUrl", "sourceId", "sourceType", "summary", "materialKind", "accessScope"):
            if not isinstance(row.get(field), str) or not row[field].strip():
                raise ValueError("Missing required string field: " + field)
        if row["id"] in seen or key(row["courseCode"], row["courseTitle"]) not in current:
            raise ValueError("Duplicate ID or code/title does not match a current course")
        seen.add(row["id"])
        if row["materialKind"] not in MATERIAL_KINDS or row["accessScope"] not in ("public", "restricted", "personal"):
            raise ValueError("Invalid material kind or access scope")
        if parse.urlsplit(row["sourceUrl"]).scheme != "https":
            raise ValueError("Source URL must be HTTPS")
        if "term" not in row or (row["term"] is not None and not re.fullmatch(r"\d{6}", str(row["term"]))):
            raise ValueError("term must be an explicit six-digit source term or null")
        if not isinstance(row.get("faculty"), list) or not all(isinstance(name, str) for name in row["faculty"]):
            raise ValueError("faculty must be an explicit array; unknown may be []")
        rating = row.get("rating")
        if rating is not None:
            if not isinstance(rating, (int, float)) or isinstance(rating, bool) or not math.isfinite(rating):
                raise ValueError("Invalid rating")
            if not isinstance(row.get("ratingScale"), (int, float)) or isinstance(row["ratingScale"], bool) or not math.isfinite(row["ratingScale"]) or row["ratingScale"] <= 0 or not 0 <= rating <= row["ratingScale"]:
                raise ValueError("A numeric rating needs a valid explicit ratingScale")
        # A strict allowlist drops any NetID, email, cookies, raw author records,
        # browser storage, authentication metadata or imported HTML.
        safe = {field: row[field] for field in ("id", "courseCode", "courseTitle", "title", "sourceUrl", "sourceId", "sourceType", "summary", "materialKind", "accessScope", "term", "faculty")}
        safe.update(author="用户提供，未独立核实", publishedAt=row.get("publishedAt"), rating=rating, ratingScale=row.get("ratingScale") if rating is not None else None, limitations=["本地用户资料，非应用直接取得的官方评价；课程、学期与教师仍需核对。"], retrievedAt=now(), verificationStatus="user_supplied_not_independently_verified")
        result.append(safe)
    return {"metadata": {"schemaVersion": 1, "importedAt": now(), "recordCount": len(result), "accessScope": "local_only", "verifiedOfficialRecords": 0}, "reviews": result}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("validate")
    sub.add_parser("rebuild")
    check = sub.add_parser("verify-public")
    check.add_argument("--review-id", action="append", dest="ids")
    imp = sub.add_parser("import-json")
    imp.add_argument("input", type=Path)
    imp.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == "validate":
            result = validate()
        elif args.command == "rebuild":
            result = rebuild_registry()
        elif args.command == "verify-public":
            result = verify_public(args.ids)
        else:
            if args.output.resolve().is_relative_to(ROOT.resolve()):
                raise ValueError("Local imports must be written outside this public repository")
            imported = normalize_import(load(args.input), load(CATALOG))
            write(args.output, imported)
            result = {"output": str(args.output), "records": imported["metadata"]["recordCount"], "scope": "local_only", "officiallyVerified": False}
    except (OSError, ValueError, KeyError, TypeError) as exc:
        parser.exit(1, f"Review source operation failed: {exc}\n")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
