// src/index.mjs
import express from "express";
import sql from "mssql";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const dbConfig = {
  server: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASS || "Postbank1!",
  database: process.env.DB_NAME || "master",
  port: parseInt(process.env.DB_PORT || "1433", 10),
  options: { trustServerCertificate: true, encrypt: false },
  pool: { max: 10, min: 0 },
};

const RECORDER_URL =
  process.env.RECORDER_URL || "http://localhost:4000/jsonrpc";

const MAX_LIMIT = 1000; // absolute cap
const DEFAULT_LIMIT = 200; // default timelogs returned when no limit provided

async function getPool() {
  if (!global.__sqlPool) {
    global.__sqlPool = await sql.connect(dbConfig);
  }
  return global.__sqlPool;
}

app.get("/collect", async (req, res) => {
  // parse and validate params
  console.log("Collector received request with query:", req.query);

  const userId = req.query.userId ? parseInt(req.query.userId, 10) : null;
  const projectId = req.query.projectId
    ? parseInt(req.query.projectId, 10)
    : null;
  let limit = req.query.limit ? parseInt(req.query.limit, 10) : DEFAULT_LIMIT;
  if (isNaN(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const filterDesc = {
    userId: userId ?? "all",
    projectId: projectId ?? "all",
    limit,
  };

  try {
    const pool = await getPool();

    let timelogQuery = `SELECT TOP (@limit) id, userId, projectId, WorkDate, Hours
                        FROM dbo.TimeLog`;
    const tlReq = pool.request().input("limit", sql.Int, limit);

    const whereClauses = [];
    if (userId) {
      whereClauses.push("userId = @userId");
      tlReq.input("userId", sql.Int, userId);
    }
    if (projectId) {
      whereClauses.push("projectId = @projectId");
      tlReq.input("projectId", sql.Int, projectId);
    }
    if (whereClauses.length) {
      timelogQuery += " WHERE " + whereClauses.join(" AND ");
    }
    timelogQuery += " ORDER BY WorkDate DESC, id DESC";

    const timelogsRs = await tlReq.query(timelogQuery);
    const timelogs = timelogsRs.recordset || [];

    const payload = {
      collectedAt: new Date().toISOString(),
      filter: filterDesc,
      data: { timelogs },
    };

    // JSON-RPC 2.0 call to recorder (axios)
    const rpc = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "recordChrono",
      params: payload,
    };

    const resp = await axios.post(RECORDER_URL, rpc, {
      headers: { "Content-Type": "application/json" },
      timeout: 20000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: null,
    });

    // handle non-JSON responses gracefully
    if (!resp || !resp.data || typeof resp.data !== "object") {
      console.error(
        "Recorder returned non-JSON:",
        typeof resp.data,
        resp.status
      );
      return res.status(502).json({
        error: "Recorder returned non-JSON response",
        status: resp ? resp.status : "no-response",
      });
    }

    return res.json({
      ok: true,
      recorderResponse: resp.data,
      payloadSummary: { timesheetCount: timelogs.length },
    });
  } catch (err) {
    console.error("Collector error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Collector running on ${PORT}`));
