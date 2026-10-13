import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { loadConfig } from "../config.js";
import { newUlid } from "../ids.js";
import { createPool } from "./pool.js";

type ResearchRecord = {
  record_id: string;
  source: string;
  source_url: string;
  sourceUrl: string;
  title: string;
  region: string;
  city: string;
  starts_on: string;
  ends_on: string;
  granularity: string;
  duplicateKey: string;
  payloadSha256: string;
};
type ImportFile = {
  schemaVersion: number;
  sampleOnly: boolean;
  sourceFileSha256: string;
  summary: { exactDuplicateGroups: string[][]; rawRecords: number };
  records: ResearchRecord[];
};

const config = loadConfig();
if (config.nodeEnv === "production" || !config.researchSampleMode) {
  throw new Error(
    "Research sample import requires non-production NODE_ENV and RESEARCH_SAMPLE_MODE=true",
  );
}
const importPath = resolve(process.argv[2] ?? ".tmp/research-import.json");
const input = JSON.parse(await readFile(importPath, "utf8")) as ImportFile;
if (
  input.schemaVersion !== 1 ||
  input.sampleOnly !== true ||
  input.records.length !== 41 ||
  input.summary.rawRecords !== 41
) {
  throw new Error("Input is not the expected research-only public web sample");
}
const pool = createPool(config.mysql);

try {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const sourceIds = new Map<string, string>();
    for (const record of input.records) {
      if (sourceIds.has(record.source)) continue;
      const sourceUrl = new URL(record.sourceUrl);
      await connection.execute(
        `INSERT INTO data_sources
           (id, source_code, name_ko, source_type, base_url, access_approval, media_licensed, is_enabled)
         VALUES (?, ?, ?, 'OFFICIAL_PAGE', ?, 'PENDING', FALSE, FALSE)
         ON DUPLICATE KEY UPDATE source_code = VALUES(source_code)`,
        [
          newUlid(),
          `RESEARCH_${record.source}`,
          record.source,
          sourceUrl.origin,
        ],
      );
      const [found] = await connection.execute(
        "SELECT id FROM data_sources WHERE source_code = ?",
        [`RESEARCH_${record.source}`],
      );
      const stored = (found as Array<RowDataPacket & { id: string }>)[0];
      if (!stored)
        throw new Error(`Unable to load data source ${record.source}`);
      sourceIds.set(record.source, stored.id);
    }

    const recordIds = new Map<string, string>();
    for (const record of input.records) {
      const sourceId = sourceIds.get(record.source);
      if (!sourceId) throw new Error(`Missing source ${record.source}`);
      const payload = JSON.stringify({
        ...record,
        sampleOnly: true,
        label: "연구 표본 / 최신 모집상태 미검증",
      });
      await connection.execute(
        `INSERT INTO source_records
           (id, source_id, source_item_key, upstream_url, payload_json, payload_sha256, last_sync_run_id, is_tombstoned)
         VALUES (?, ?, ?, ?, ?, ?, NULL, FALSE)
         ON DUPLICATE KEY UPDATE upstream_url = VALUES(upstream_url), payload_json = VALUES(payload_json),
           last_changed_utc = IF(payload_sha256 <> VALUES(payload_sha256), CURRENT_TIMESTAMP(3), last_changed_utc),
           payload_sha256 = VALUES(payload_sha256), last_seen_utc = CURRENT_TIMESTAMP(3), is_tombstoned = FALSE`,
        [
          newUlid(),
          sourceId,
          record.record_id,
          record.sourceUrl,
          payload,
          record.payloadSha256,
        ],
      );
      const [found] = await connection.execute(
        "SELECT id FROM source_records WHERE source_id = ? AND source_item_key = ?",
        [sourceId, record.record_id],
      );
      const stored = (found as Array<RowDataPacket & { id: string }>)[0];
      if (!stored)
        throw new Error(`Unable to load source record ${record.record_id}`);
      recordIds.set(record.record_id, stored.id);
    }

    let mergeCases = 0;
    for (const group of input.summary.exactDuplicateGroups) {
      for (let left = 0; left < group.length; left += 1) {
        for (let right = left + 1; right < group.length; right += 1) {
          const leftId = recordIds.get(group[left]!);
          const rightId = recordIds.get(group[right]!);
          if (!leftId || !rightId)
            throw new Error(
              `Missing duplicate source record for ${group[left]} / ${group[right]}`,
            );
          await connection.execute(
            `INSERT INTO merge_review_cases (id, left_source_record_id, right_source_record_id, reason, decision)
             VALUES (?, ?, ?, 'Exact title, place, level, and date match in research sample; curator review required', 'OPEN')
             ON DUPLICATE KEY UPDATE reason = VALUES(reason)`,
            [newUlid(), leftId, rightId],
          );
          mergeCases += 1;
        }
      }
    }
    await connection.commit();
    console.log(
      JSON.stringify(
        {
          sampleOnly: true,
          sourceFileSha256: input.sourceFileSha256,
          importedSourceRecords: recordIds.size,
          mergeReviewCases: mergeCases,
          activitiesPublished: 0,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
} finally {
  await pool.end();
}
