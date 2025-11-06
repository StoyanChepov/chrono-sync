import express from "express";
import sql from "mssql";

const app = express();
//app.use(express.json());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const dbConfig = {
  server: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASS || "Postbank1!",
  database: process.env.DB_NAME || "master",
  port: parseInt(process.env.DB_PORT || "1433", 10),
  options: { trustServerCertificate: true },
};

app.post("/jsonrpc", async (req, res) => {
  const { method, params, id } = req.body;

  if (method !== "recordChrono") {
    return res.json({ jsonrpc: "2.0", error: "Unknown method", id });
  }

  try {
    const pool = await sql.connect(dbConfig);
    const filterJson = params.filter !== undefined ? JSON.stringify(params.filter) : null;
    const payloadJson = JSON.stringify(params);

    await pool
      .request()
      .input("json", sql.NVarChar(sql.MAX), JSON.stringify(params)).query(`
                INSERT INTO ChronoLog (ReceivedAt, JsonRpcId, Filter, Payload)
                VALUES (GETDATE(), '${id}', '${filterJson}', '${payloadJson}')
            `);

    res.json({ jsonrpc: "2.0", result: "ok", id });
  } catch (err) {
    res.json({ jsonrpc: "2.0", error: err.message, id });
  }
});

app.listen(4000, () => console.log("Recorder running on 4000"));
