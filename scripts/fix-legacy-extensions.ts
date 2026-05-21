/**
 * Adds proper file extensions to legacy migrated attachments.
 *
 * Background: scripts/migrate-attachments.ts uploaded files into
 *   attachments/afastamentos/legacy/<bare-name>
 * preserving the original (extensionless) filename from the legacy bucket.
 * Supabase Storage's signed-URL download chokes on these bare paths, which
 * breaks fluig-push attachment downloads.
 *
 * This script:
 *   1. Finds afastamentos with arquivo_url under afastamentos/legacy/ that
 *      have no extension.
 *   2. Downloads each via the storage SDK (service role, no signed URL).
 *   3. Sniffs the MIME from magic bytes.
 *   4. Copies the object to <path>.<ext>, updates arquivo_url, deletes the
 *      original. Skips files whose MIME can't be detected.
 *
 * Run:
 *   npx tsx --env-file .env.local scripts/fix-legacy-extensions.ts [--dry-run]
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "attachments";
const PAGE_SIZE = 200;
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1]);

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/webp": "webp",
};

function guessMime(buf: Uint8Array): string | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf[0] === 0x42 && buf[1] === 0x4d) return "image/bmp";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function hasExtension(path: string): boolean {
  const filename = path.split("/").pop() ?? "";
  return /\.[a-z0-9]{2,5}$/i.test(filename);
}

function makeClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

async function main() {
  const supabase = makeClient();
  if (DRY_RUN) console.log("[DRY RUN — no writes]");

  // Step 1: find all legacy-pathed afastamentos
  const rows: Array<{ id: string; arquivo_url: string }> = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("afastamentos")
      .select("id, arquivo_url")
      .ilike("arquivo_url", "afastamentos/legacy/%")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as typeof rows));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const allNeedingFix = rows.filter((r) => r.arquivo_url && !hasExtension(r.arquivo_url));
  const needsFix =
    Number.isFinite(LIMIT) && LIMIT > 0 ? allNeedingFix.slice(0, LIMIT) : allNeedingFix;
  console.log(`Total legacy rows: ${rows.length}`);
  console.log(`Without extension:  ${allNeedingFix.length}`);
  if (needsFix.length !== allNeedingFix.length) {
    console.log(`Processing (limit):  ${needsFix.length}`);
  }

  let ok = 0;
  let unknownMime = 0;
  let downloadFail = 0;
  let copyFail = 0;
  let dbFail = 0;

  for (const row of needsFix) {
    const oldPath = row.arquivo_url;
    try {
      const { data, error: dlErr } = await supabase.storage.from(BUCKET).download(oldPath);
      if (dlErr || !data) {
        console.warn(`  [DOWNLOAD_FAIL] ${oldPath}: ${dlErr?.message ?? "no data"}`);
        downloadFail++;
        continue;
      }
      const bytes = new Uint8Array(await data.arrayBuffer());
      const mime = guessMime(bytes.subarray(0, 12));
      if (!mime) {
        console.warn(`  [UNKNOWN_MIME] ${oldPath} (size=${bytes.byteLength})`);
        unknownMime++;
        continue;
      }
      const ext = MIME_TO_EXT[mime];
      const newPath = `${oldPath}.${ext}`;

      if (DRY_RUN) {
        console.log(`  [DRY] ${oldPath} -> ${newPath} (${mime}, ${bytes.byteLength} bytes)`);
        ok++;
        continue;
      }

      // Copy storage object (preserves content-type via the source's metadata).
      const { error: copyErr } = await supabase.storage.from(BUCKET).copy(oldPath, newPath);
      if (copyErr) {
        // Tolerate "already exists" — assume a previous run partially completed.
        if (!copyErr.message.toLowerCase().includes("already")) {
          console.warn(`  [COPY_FAIL] ${oldPath} -> ${newPath}: ${copyErr.message}`);
          copyFail++;
          continue;
        }
      }

      const { error: updErr } = await supabase
        .from("afastamentos")
        .update({ arquivo_url: newPath })
        .eq("id", row.id);
      if (updErr) {
        console.warn(`  [DB_FAIL] ${row.id}: ${updErr.message}`);
        dbFail++;
        continue;
      }

      const { error: rmErr } = await supabase.storage.from(BUCKET).remove([oldPath]);
      if (rmErr) {
        console.warn(`  [DELETE_WARN] ${oldPath}: ${rmErr.message} (DB already updated)`);
      }

      console.log(`  [OK] ${oldPath} -> ${newPath} (${mime}, ${bytes.byteLength} bytes)`);
      ok++;
    } catch (err) {
      console.warn(`  [EXCEPTION] ${oldPath}: ${(err as Error).message}`);
      downloadFail++;
    }
  }

  console.log(
    `\nDone — ok=${ok} unknown_mime=${unknownMime} download_fail=${downloadFail} copy_fail=${copyFail} db_fail=${dbFail}`,
  );
  if (unknownMime > 0) {
    console.log(
      `\nFiles flagged UNKNOWN_MIME may be corrupted (e.g. uploaded with the Node Buffer-pool bug` +
      ` in migrate-attachments.ts when file < 8KB). They likely need re-migration from the legacy pool.`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
