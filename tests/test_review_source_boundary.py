"""Protect the boundary between local user exports and public review material."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("review_sources", ROOT / "scripts/review_sources.py")
reviews = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reviews)


class ReviewSourceBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads((ROOT / "data/catalog.json").read_text())
        cls.example = {
            "id": "local-sample", "courseCode": "MGT 554", "courseTitle": "AI for Business Decisions",
            "title": "User-provided historical experience", "sourceUrl": "https://example.com/source",
            "sourceId": "user_provided", "sourceType": "user_supplied_experience",
            "summary": "A locally supplied summary, not verified official feedback.",
            "materialKind": "user_supplied_experience", "accessScope": "restricted",
            "term": None, "faculty": [],
        }

    def test_current_registry_matches_every_section_and_no_authenticated_feed_is_claimed(self):
        result = reviews.validate()
        self.assertTrue(result["valid"])
        self.assertEqual(result["courseSections"], len(self.catalog["courses"]))
        self.assertEqual(result["authenticatedSOMEvaluations"], 0)

    def test_local_normalization_drops_credentials_and_identity_metadata(self):
        row = copy.deepcopy(self.example)
        row.update(NetID="DO-NOT-PUBLISH", email="private@example.test", cookies={"session": "secret"}, author="Private student", rawHtml="<script>unsafe</script>")
        output = reviews.normalize_import({"reviews": [row]}, self.catalog)
        record = output["reviews"][0]
        for field in ("NetID", "email", "cookies", "rawHtml"):
            self.assertNotIn(field, record)
        self.assertNotEqual(record["author"], "Private student")
        self.assertEqual(output["metadata"]["accessScope"], "local_only")
        self.assertEqual(output["metadata"]["verifiedOfficialRecords"], 0)

    def test_same_code_unrelated_subject_cannot_import_as_current_course(self):
        row = copy.deepcopy(self.example)
        row["courseTitle"] = "Luxury: From Mortal Sin to Market Sector"
        with self.assertRaisesRegex(ValueError, "code/title"):
            reviews.normalize_import({"reviews": [row]}, self.catalog)

    def test_unknown_source_term_does_not_silently_become_current_term(self):
        output = reviews.normalize_import({"reviews": [copy.deepcopy(self.example)]}, self.catalog)
        self.assertIsNone(output["reviews"][0]["term"])
        self.assertEqual(output["reviews"][0]["verificationStatus"], "user_supplied_not_independently_verified")


if __name__ == "__main__":
    unittest.main()
