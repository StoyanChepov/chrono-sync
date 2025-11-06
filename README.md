# Chrono Sync

Two small Node.js microservices (Collector + Recorder) with MS SQL database.

- **Collector** (port 3000) — REST `/collect` endpoint, collects DB rows and sends them to Recorder via JSON-RPC.
- **Recorder** (port 4000) — JSON-RPC endpoint `/jsonrpc` that stores received payloads into `ChronoLog`.

---

## Prerequisites

- Node.js v16+ (v18+ recommended)
- npm
- MS SQL Server installed locally

---

## Repository layout (recommended)



---

## 1) Install dependencies (root)

Run once in the **project root** to install dev tools for running both services at once:

```bash
npm install

---

## 2) Start the DB

Run the following command to call the db_script.js file which creates the tables and fills them with data by executing the scripts in db_init.sql by dividing them into batches. Every time this command is called the User, Project and TimeLog tables are emptied. The ChronoLog table is being dropped and created again on each call.

```bash
npm run db

---

## 3) Start microservices (dev)

 run both collector and recorder concurrently (auto-restart on file changes)
    
```bash
npm run dev:all

or start them separetely:

```bash
npm run dev:collector
npm run dev:recorder

---
Test the pipeline

Ensure recorder is running on port 4000.

Ensure collector is running on port 3000.

Trigger collector:
GET http://localhost:3000/collect

Build TimeLog query with parameters

Allowed query params are userId, projectId and limit
GET http://localhost:3000/collect?userId=23&projectId=1&limit=5
The maximum of rows returned is 1000

// select TOP (@limit) rows ordered by WorkDate desc (most recent first)
// If no filters are provided, returns up to LIMIT timelogs

No .env file is needed. The variables used default to:
DB_HOST=localhost
DB_PORT=1433
DB_USER=sa
DB_PASS=Postbank1!
DB_NAME=master