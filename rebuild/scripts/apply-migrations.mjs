import { readFile } from "node:fs/promises";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const databaseId = "44a5859b-6411-4513-bd17-3302fbbc0575";
if (!accountId || !token) throw new Error("Cloudflare account and API token are required to apply D1 migrations.");

const migration = await readFile(new URL("../worker/migrations/0004_password_attempt_limits.sql", import.meta.url), "utf8");
const statements = migration.split(";").map(statement => statement.trim()).filter(Boolean);
for (const sql of statements) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ sql })
  });
  const result = await response.json();
  if (!response.ok || !result.success || result.errors?.length) {
    throw new Error(`D1 migration failed: ${JSON.stringify(result.errors ?? result)}`);
  }
}
process.stdout.write("D1 password-attempt migration applied.\n");
