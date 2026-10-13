import csv
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from ingest_python.cli import inspect

ROOT = Path(__file__).parents[3]
SAMPLE = ROOT / "data" / "research-samples" / "verified_public_web_sample_2026-10-13.csv"


class IngestTests(unittest.TestCase):
    def test_research_sample_counts_and_hashes(self):
        records, summary, file_hash = inspect(SAMPLE)
        self.assertEqual(len(records), 41)
        self.assertEqual(summary["regionCount"], 17)
        self.assertEqual(summary["scheduleStatusCounts"], {"PAST": 18, "ONGOING": 2, "FUTURE": 21})
        self.assertEqual(summary["duplicateGroupCount"], 4)
        self.assertEqual(len(file_hash), 64)
        self.assertTrue(all(len(record["payloadSha256"]) == 64 for record in records))
        self.assertTrue(all(record["source_url"].startswith("https://") for record in records))

    def test_invalid_external_scheme_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            bad = Path(directory) / "bad.csv"
            with SAMPLE.open(encoding="utf-8-sig", newline="") as source:
                rows = list(csv.DictReader(source))
                fields = list(rows[0])
            rows[0]["source_url"] = "javascript:alert(1)"
            with bad.open("w", encoding="utf-8-sig", newline="") as target:
                writer = csv.DictWriter(target, fieldnames=fields)
                writer.writeheader()
                writer.writerows(rows)
            with self.assertRaisesRegex(ValueError, "source_url must be an HTTPS URL"):
                inspect(bad)
