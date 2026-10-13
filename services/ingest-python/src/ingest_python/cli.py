from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

REFERENCE_DATE = date(2026, 10, 13)
EXPECTED_STATUS_COUNTS = {"PAST": 18, "ONGOING": 2, "FUTURE": 21}
EXPECTED_RECORDS = 41
EXPECTED_REGIONS = 17
EXPECTED_DUPLICATE_GROUPS = 4


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _safe_https_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.hostname) and not parsed.username and not parsed.password


def _duplicate_key(row: dict[str, str]) -> str:
    title = re.sub(r"\s+", "", row["title"]).casefold()
    return "|".join(
        (
            row["granularity"],
            row["region"],
            row["city"],
            title,
            row["starts_on"],
            row["ends_on"],
        )
    )


def inspect(path: Path) -> tuple[list[dict[str, str]], dict[str, object], str]:
    raw = path.read_bytes()
    text = raw.decode("utf-8-sig")
    rows = list(csv.DictReader(text.splitlines()))
    errors: list[str] = []
    required = {"record_id", "source", "source_url", "title", "region", "city", "starts_on", "ends_on", "granularity"}
    if not rows:
        errors.append("CSV contains no records")
    elif not required.issubset(rows[0]):
        errors.append(f"Missing columns: {', '.join(sorted(required - set(rows[0])))}")

    status_counts: Counter[str] = Counter()
    regions: set[str] = set()
    duplicate_groups: dict[str, list[str]] = defaultdict(list)
    normalized: list[dict[str, object]] = []
    for index, row in enumerate(rows, start=2):
        try:
            starts = date.fromisoformat(row["starts_on"])
            ends = date.fromisoformat(row["ends_on"])
            if ends < starts:
                errors.append(f"Line {index}: end date precedes start date")
            status = "PAST" if ends < REFERENCE_DATE else "FUTURE" if starts > REFERENCE_DATE else "ONGOING"
            if status != row.get("schedule_status_on_2026_10_13"):
                errors.append(f"Line {index}: stored date status does not match the reference date")
        except (KeyError, ValueError):
            errors.append(f"Line {index}: invalid ISO date")
            status = "INVALID"

        if not _safe_https_url(row.get("source_url", "")):
            errors.append(f"Line {index}: source_url must be an HTTPS URL without user information")
        for field in ("event_detail_url", "reservation_detail_url"):
            if row.get(field) and not _safe_https_url(row[field]):
                errors.append(f"Line {index}: {field} must be an HTTPS URL without user information")
        if row.get("price_class") not in {"FREE", "PAID", "MIXED", "UNKNOWN"}:
            errors.append(f"Line {index}: unknown price_class")

        status_counts[status] += 1
        regions.add(row.get("region", ""))
        duplicate_groups[_duplicate_key(row)].append(row.get("record_id", ""))
        payload_json = json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        normalized.append(
            {
                **row,
                "duplicateKey": _duplicate_key(row),
                "payloadSha256": _sha256(payload_json.encode("utf-8")),
                "sourceUrl": row["source_url"],
            }
        )

    groups = [ids for ids in duplicate_groups.values() if len(ids) > 1]
    if len(rows) != EXPECTED_RECORDS:
        errors.append(f"Expected {EXPECTED_RECORDS} records, found {len(rows)}")
    if len(regions) != EXPECTED_REGIONS:
        errors.append(f"Expected {EXPECTED_REGIONS} regions, found {len(regions)}")
    if len(groups) != EXPECTED_DUPLICATE_GROUPS:
        errors.append(f"Expected {EXPECTED_DUPLICATE_GROUPS} exact duplicate groups, found {len(groups)}")
    if dict(status_counts) != EXPECTED_STATUS_COUNTS:
        errors.append(f"Unexpected date classification counts: {dict(status_counts)}")

    summary: dict[str, object] = {
        "sampleOnly": True,
        "referenceDate": REFERENCE_DATE.isoformat(),
        "rawRecords": len(rows),
        "regionCount": len(regions),
        "scheduleStatusCounts": dict(status_counts),
        "exactDuplicateGroups": groups,
        "duplicateGroupCount": len(groups),
        "sourceFileSha256": _sha256(raw),
        "errors": errors,
    }
    if errors:
        raise ValueError(json.dumps(summary, ensure_ascii=False, indent=2))
    return normalized, summary, _sha256(raw)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate and normalize the research-only public web sample.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    for name in ("validate", "export"):
        subparser = subparsers.add_parser(name)
        subparser.add_argument("csv_path", type=Path)
        if name == "export":
            subparser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        rows, summary, file_hash = inspect(args.csv_path)
    except (OSError, UnicodeError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if args.command == "validate":
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0

    output = {
        "schemaVersion": 1,
        "sampleOnly": True,
        "referenceDate": REFERENCE_DATE.isoformat(),
        "sourceFile": args.csv_path.name,
        "sourceFileSha256": file_hash,
        "summary": summary,
        "records": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Exported {len(rows)} research-only source records to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
