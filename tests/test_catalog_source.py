"""Regression checks for the source-to-product boundary; no network required."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("catalog", ROOT / "scripts/fetch_catalog.py")
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)


class CatalogSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = json.loads((ROOT / "tests/fixtures/catalog-source-samples.json").read_text())

    def test_actual_official_description_is_not_replaced_by_editorial_summary(self):
        row = self.fixture["rows"][0]
        course = catalog.normalize_course(row, self.fixture["sourceUrl"])
        self.assertEqual(course["description"], row["courseDescription"])
        self.assertIn("historical business data", course["description"])
        self.assertEqual(course["summaryType"], "official_description_excerpt")
        self.assertTrue(course["description"].startswith(course["descriptionPreview"].rstrip("…")))
        self.assertEqual(course["directoryUrl"], "https://som.yale.edu/elective-core-courses")
        self.assertNotEqual(course["directoryUrl"], course["sourceUrl"])

    def test_parser_close_keeps_real_description_ending_in_ampersand(self):
        row = self.fixture["rows"][1]
        self.assertTrue(row["courseDescription"].endswith("Q&A."))
        course = catalog.normalize_course(row, self.fixture["sourceUrl"])
        self.assertTrue(course["description"].endswith("Q&A."))
        self.assertIn("400 pages", course["description"])

    def test_html_and_entities_are_plain_text_with_readable_paragraphs(self):
        html = '<p>First &amp; useful.</p><p>Second<br>line.</p><script>alert(1)</script><style>.x{display:none}</style><ul><li>One</li><li>Two</li></ul>'
        text = catalog.plain_text(html)
        self.assertIn("First & useful.\n\nSecond\nline.", text)
        self.assertIn("One\n\nTwo", text)
        self.assertNotIn("alert", text)
        self.assertNotIn("display:none", text)
        self.assertNotIn("<", text)

    def test_missing_or_whitespace_description_is_actually_missing(self):
        row = copy.deepcopy(self.fixture["rows"][0])
        for value in [None, "", " \r\n ", "<p>&nbsp;</p>"]:
            row["courseDescription"] = value
            course = catalog.normalize_course(row, self.fixture["sourceUrl"])
            self.assertIsNone(course["description"])
            self.assertIsNone(course["summary"])
            self.assertIsNone(course["descriptionSource"])

    def test_reused_course_number_does_not_share_description(self):
        first = copy.deepcopy(self.fixture["rows"][0])
        second = copy.deepcopy(first)
        second.update(courseTitle="An unrelated course", courseDescription="Distinct official evidence.")
        self.assertNotEqual(catalog.normalize_course(first, "source")["description"], catalog.normalize_course(second, "source")["description"])
        self.assertEqual(catalog.normalize_course(second, "source")["description"], "Distinct official evidence.")

    def test_blank_room_and_unsafe_syllabus_are_not_promoted_to_links(self):
        row = copy.deepcopy(self.fixture["rows"][0])
        row.update(room=" ", syllabus="javascript:alert(1)", oldSyllabus=" https://example.com/history ")
        course = catalog.normalize_course(row, "source")
        self.assertIsNone(course["room"])
        self.assertIsNone(course["syllabusUrl"])
        self.assertEqual(course["oldSyllabusUrl"], "https://example.com/history")

    def test_committed_snapshot_cannot_silently_drop_description_coverage(self):
        snapshot = json.loads((ROOT / "data/catalog.json").read_text())
        count = sum(bool(c.get("description")) for c in snapshot["courses"])
        self.assertEqual(len(snapshot["courses"]), snapshot["metadata"]["recordCount"])
        self.assertEqual(count, snapshot["metadata"]["descriptionCoverage"]["provided"])
        self.assertGreaterEqual(count, 200, "This snapshot previously contained 211 descriptions; investigate a large coverage drop.")
        self.assertTrue(all(c.get("descriptionSource") == "official_catalog" for c in snapshot["courses"] if c.get("description")))
        self.assertTrue(all(c.get("summaryType") != "editorial_paraphrase_of_course_topics" for c in snapshot["courses"]))


if __name__ == "__main__":
    unittest.main()
