import fs from "fs";
import { fileURLToPath } from 'url';
import path, { dirname } from "path";
import sql from "mssql";
import "dotenv/config";


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SQL_FILE = path.join(__dirname, ".", "db_init.sql"); // adjust if needed

const poolConfigBase = {
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASS || "Postbank1!",
  server: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "1433", 10),
  options: { trustServerCertificate: true, encrypt: false },
  pool: { max: 5, min: 0 },
};

function splitBatches(sqlText) {
  const normalized = sqlText.replace(/\r\n/g, "\n");
  const rawParts = normalized.split(/^\s*GO\s*$/gim).map((p) => p);
  const trimmed = rawParts.map((s) => s.trim()).filter((s) => s.length > 0);
  const finalParts = [];
  const procRegex = /\b(CREATE|ALTER)\s+PROCEDURE\b/i;

  for (const part of trimmed) {
    const m = procRegex.exec(part);
    if (m && m.index > 0) {
      // There's a CREATE/ALTER PROCEDURE not at the start => split
      const idx = m.index;
      const before = part.slice(0, idx).trim();
      const procAndAfter = part.slice(idx).trim();
      if (before.length > 0) finalParts.push(before);
      finalParts.push(procAndAfter);
    } else {
      finalParts.push(part);
    }
  }

  return finalParts;
}

async function execBatches(batches) {
  let currentDb = "master";
  let pool = await sql.connect({ ...poolConfigBase, database: currentDb });

  for (let i = 0; i < batches.length; i++) {
    let batch = batches[i];
    if (!batch || !batch.trim()) continue;

    // Ensure pool is connected to the intended db (currentDb)
    if (!pool.connected || pool.config.database !== currentDb) {
      try {
        await pool.close();
      } catch (e) {}
      pool = await sql.connect({ ...poolConfigBase, database: currentDb });
    }

    console.log(
      `\n--- Executing batch ${i + 1}/${batches.length} (DB=${currentDb}) ---`
    );
    const preview = batch.length > 200 ? batch.slice(0, 200) + "..." : batch;
    console.log(preview);

    try {
      await pool.request().batch(batch);
      console.log(`Batch ${i + 1} OK`);
    } catch (err) {
      // Special case: sometimes the driver error shows misleading location.
      // Re-throw with more context.
      throw new Error(
        `Error executing batch ${i + 1} on DB=${currentDb}: ${
          err.message || err
        }`
      );
    }
  }

  try {
    await pool.close();
  } catch (e) {}
}

(async () => {
  try {
    if (!fs.existsSync(SQL_FILE)) {
      console.error("SQL file not found:", SQL_FILE);
      process.exit(1);
    }

    const sqlText = fs.readFileSync(SQL_FILE, "utf8");
    const batches = splitBatches(sqlText);

    console.log(`Found ${batches.length} batch(es) after processing.`);

    await execBatches(batches);

    console.log("\nAll batches executed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Init failed:", err && err.message ? err.message : err);
    process.exit(2);
  }
})();
