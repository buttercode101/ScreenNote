import { readFile } from "node:fs/promises";
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const databaseId = "44a5859b-6411-4513-bd17-3302fbbc0575";
if (!accountId || !token) throw new Error("Cloudflare account and API token are required to apply D1 migrations.");
for (const migrationFile of ["0001_initial.sql", "0002_temporary_sharing.sql", "0003_frame_annotations.sql", "0004_password_attempt_limits.sql", "0005_legacy_clip_api.sql", "0006_legacy_cleanup_cursor.sql", "0007_legacy_clip_tombstones.sql", "0008_share_details.sql", "0009_resumable_recording_uploads.sql", "0010_share_reactions.sql", "0011_share_reviews.sql", "0012_share_action_rate_limits.sql"]) {
  const migration = await readFile(new URL("../worker/migrations/" + migrationFile, import.meta.url), "utf8");
  const statements = migration.split(";").map(statement => statement.trim()).filter(Boolean);
  for (const sql of statements) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ sql })
    });
    const result = await response.json();
    const duplicateColumn = sql.startsWith("ALTER TABLE")
      && (result.errors ?? []).some(error => String(error.message || "").toLowerCase().includes("duplicate column"));
    if (duplicateColumn) continue;
    if (!response.ok || !result.success || result.errors?.length) {
      throw new Error(`D1 migration ${migrationFile} failed: ${JSON.stringify(result.errors ?? result)}`);
    }
  }
  process.stdout.write("D1 migration applied: " + migrationFile + "\n");
}
