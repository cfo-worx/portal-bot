import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse as parseCsv } from "csv-parse/sync";
import { poolPromise, sql } from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------------
// Helpers
// -------------------------------

function isUuid(v) {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function requireUuid(name, value) {
  if (!isUuid(value)) {
    const err = new Error(`${name} must be a UUID`);
    err.status = 400;
    throw err;
  }
  return value;
}

function safeJsonParse(str, fallback = {}) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function nowUtcIso() {
  return new Date().toISOString();
}

function toPeriodKey(d) {
  // YYYY-MM
  const dt = new Date(d);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function normalizeWeekEndingFriday(dateStr) {
  // Ensure we use a Friday-ending week. If user passes a date, snap to nearest prior Friday (UTC).
  const d = new Date(dateStr);
  const day = d.getUTCDay(); // 0 Sun ... 5 Fri
  const diff = (day >= 5 ? day - 5 : day + 2); // days since Friday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

const DEFAULT_CLOSE_CHECKLIST = [
  { key: "bank_reconcile", label: "Reconcile all bank accounts" },
  { key: "credit_reconcile", label: "Reconcile all credit card accounts" },
  { key: "ar_aging", label: "Review A/R aging + collection notes" },
  { key: "ap_aging", label: "Review A/P aging + vendor payment plan" },
  { key: "payroll", label: "Post payroll allocations/accruals (if needed)" },
  { key: "debt", label: "Update debt schedule / amortization entries" },
  { key: "depr_amort", label: "Post depreciation/amortization" },
  { key: "revenue_review", label: "Revenue/cash receipts review (by customer, vs budget)" },
  { key: "expense_review", label: "Expense variance review (by vendor, vs budget)" },
  { key: "final_review", label: "Final review: statements ready for reporting package" },
];

async function ensureClientWorkSettings(clientId) {
  const pool = await poolPromise;
  await pool
    .request()
    .input("ClientID", sql.UniqueIdentifier, clientId)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.ClientWorkSettings WHERE ClientID = @ClientID)
      BEGIN
        INSERT INTO dbo.ClientWorkSettings (ClientWorkSettingsID, ClientID, SettingsJson)
        VALUES (NEWID(), @ClientID, N'{}')
      END
    `);
}

async function getClientName(clientId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("ClientID", sql.UniqueIdentifier, clientId)
    .query(`SELECT ClientName FROM dbo.Client WHERE ClientID = @ClientID`);
  return result.recordset?.[0]?.ClientName || "Client";
}

// -------------------------------
// Settings
// -------------------------------

export async function getClientWorkSettings(req, res) {
  try {
    const clientId = requireUuid("clientId", req.query.clientId);
    await ensureClientWorkSettings(clientId);
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .query(`SELECT ClientWorkSettingsID, SettingsJson, CreatedAt, UpdatedAt FROM dbo.ClientWorkSettings WHERE ClientID = @ClientID`);
    const row = result.recordset?.[0];
    res.json({
      clientId,
      clientWorkSettingsId: row?.ClientWorkSettingsID,
      settings: safeJsonParse(row?.SettingsJson, {}),
      createdAt: row?.CreatedAt,
      updatedAt: row?.UpdatedAt,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to get settings" });
  }
}

export async function updateClientWorkSettings(req, res) {
  try {
    const clientId = requireUuid("clientId", req.body.clientId);
    const settings = req.body.settings || {};
    await ensureClientWorkSettings(clientId);
    const pool = await poolPromise;
    await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .input("SettingsJson", sql.NVarChar(sql.MAX), JSON.stringify(settings))
      .query(`
        UPDATE dbo.ClientWorkSettings
        SET SettingsJson = @SettingsJson, UpdatedAt = SYSUTCDATETIME()
        WHERE ClientID = @ClientID
      `);
    res.json({ ok: true, clientId, settings });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to update settings" });
  }
}

// -------------------------------
// Dashboard Summary (top-level)
// -------------------------------

export async function getClientWorkDashboardSummary(req, res) {
  try {
    const clientId = requireUuid("clientId", req.query.clientId);
    await ensureClientWorkSettings(clientId);

    const pool = await poolPromise;

    // Latest AI run
    const aiRun = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .query(`
        SELECT TOP 1 AIRunID, PeriodKey, Status, UpdatedAt
        FROM dbo.ClientWorkAIRuns
        WHERE ClientID = @ClientID
        ORDER BY UpdatedAt DESC
      `);

    // Latest cash forecast (Base)
    const cf = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .input("ScenarioName", sql.NVarChar(50), "Base")
      .query(`
        SELECT TOP 1 CashForecastID, StartWeekEndingDate, StartingCashBalanceOverride, StartingLiquidityAvailable,
               WarningCashThreshold, CriticalCashThreshold, UpdatedAt
        FROM dbo.ClientWorkCashForecasts
        WHERE ClientID = @ClientID AND ScenarioName = @ScenarioName
        ORDER BY UpdatedAt DESC
      `);

    // Latest close run
    const closeRun = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .query(`
        SELECT TOP 1 CloseRunID, PeriodKey, Status, UpdatedAt
        FROM dbo.ClientWorkCloseRuns
        WHERE ClientID = @ClientID
        ORDER BY UpdatedAt DESC
      `);

    // Open QA flags (across latest scan)
    let openFlags = 0;
    const scan = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .query(`
        SELECT TOP 1 QAScanRunID
        FROM dbo.ClientWorkCloseQAScanRuns
        WHERE ClientID = @ClientID
        ORDER BY CreatedAt DESC
      `);
    if (scan.recordset?.[0]?.QAScanRunID) {
      const flagsRes = await pool
        .request()
        .input("QAScanRunID", sql.UniqueIdentifier, scan.recordset[0].QAScanRunID)
        .query(`
          SELECT COUNT(1) AS Cnt
          FROM dbo.ClientWorkCloseQAFlags
          WHERE QAScanRunID = @QAScanRunID AND Status = 'Open'
        `);
      openFlags = flagsRes.recordset?.[0]?.Cnt || 0;
    }

    // Projects summary (if Projects table exists)
    let projectsSummary = null;
    try {
      const projRes = await pool
        .request()
        .input("ClientID", sql.UniqueIdentifier, clientId)
        .query(`
          SELECT ProjectStatus, COUNT(1) AS Cnt
          FROM dbo.Projects
          WHERE ClientID = @ClientID
          GROUP BY ProjectStatus
        `);
      const map = {};
      (projRes.recordset || []).forEach((r) => (map[r.ProjectStatus] = r.Cnt));
      projectsSummary = map;
    } catch {
      projectsSummary = null;
    }

    // Accounting staff (internal)
    const staffRes = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .query(`
        SELECT TOP 5 AccountingStaffID, FullName, RoleTitle, Email
        FROM dbo.ClientWorkAccountingStaff
        WHERE ClientID = @ClientID AND IsActive = 1
        ORDER BY FullName ASC
      `);

    res.json({
      clientId,
      ai: aiRun.recordset?.[0] || null,
      cashForecast: cf.recordset?.[0] || null,
      close: closeRun.recordset?.[0] || null,
      openQaFlags: openFlags,
      projectsSummary,
      accountingStaff: staffRes.recordset || [],
      generatedAt: nowUtcIso(),
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to get dashboard summary" });
  }
}

// -------------------------------
// Close - checklist + QA scan
// -------------------------------

export async function getOrCreateCloseRun(req, res) {
  try {
    const clientId = requireUuid("clientId", req.body.clientId || req.query.clientId);
    const periodKey = String(req.body.periodKey || req.query.periodKey || "");
    if (!/^\d{4}-\d{2}$/.test(periodKey)) {
      return res.status(400).json({ error: "periodKey must be YYYY-MM" });
    }

    const pool = await poolPromise;

    // Find existing
    const existing = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .input("PeriodKey", sql.NVarChar(10), periodKey)
      .query(`
        SELECT TOP 1 CloseRunID, Status, Notes, CreatedAt, UpdatedAt
        FROM dbo.ClientWorkCloseRuns
        WHERE ClientID = @ClientID AND PeriodKey = @PeriodKey
      `);

    let closeRunId = existing.recordset?.[0]?.CloseRunID;
    if (!closeRunId) {
      // Create
      const insert = await pool
        .request()
        .input("ClientID", sql.UniqueIdentifier, clientId)
        .input("PeriodKey", sql.NVarChar(10), periodKey)
        .input("CreatedByUserID", sql.UniqueIdentifier, req.user?.userId)
        .query(`
          DECLARE @id UNIQUEIDENTIFIER = NEWID();
          INSERT INTO dbo.ClientWorkCloseRuns (CloseRunID, ClientID, PeriodKey, Status, CreatedByUserID)
          VALUES (@id, @ClientID, @PeriodKey, 'Draft', @CreatedByUserID);
          SELECT @id AS CloseRunID;
        `);
      closeRunId = insert.recordset?.[0]?.CloseRunID;

      // Seed checklist
      for (const item of DEFAULT_CLOSE_CHECKLIST) {
        await pool
          .request()
          .input("CloseChecklistItemID", sql.UniqueIdentifier, undefined)
          .input("CloseRunID", sql.UniqueIdentifier, closeRunId)
          .input("ItemKey", sql.NVarChar(100), item.key)
          .input("ItemLabel", sql.NVarChar(255), item.label)
          .query(`
            INSERT INTO dbo.ClientWorkCloseChecklistItems (CloseChecklistItemID, CloseRunID, ItemKey, ItemLabel)
            VALUES (NEWID(), @CloseRunID, @ItemKey, @ItemLabel)
          `);
      }
    }

    const items = await pool
      .request()
      .input("CloseRunID", sql.UniqueIdentifier, closeRunId)
      .query(`
        SELECT CloseChecklistItemID, ItemKey, ItemLabel, IsComplete, CompletedAt, CompletedByUserID, Notes
        FROM dbo.ClientWorkCloseChecklistItems
        WHERE CloseRunID = @CloseRunID
        ORDER BY ItemKey ASC
      `);

    res.json({
      closeRunId,
      clientId,
      periodKey,
      status: existing.recordset?.[0]?.Status || "Draft",
      notes: existing.recordset?.[0]?.Notes || "",
      checklist: items.recordset || [],
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to get/create close run" });
  }
}

export async function updateCloseRun(req, res) {
  try {
    const closeRunId = requireUuid("closeRunId", req.params.closeRunId);
    const { status, notes } = req.body || {};
    const pool = await poolPromise;
    await pool
      .request()
      .input("CloseRunID", sql.UniqueIdentifier, closeRunId)
      .input("Status", sql.NVarChar(50), status || "Draft")
      .input("Notes", sql.NVarChar(sql.MAX), notes || "")
      .query(`
        UPDATE dbo.ClientWorkCloseRuns
        SET Status = @Status, Notes = @Notes, UpdatedAt = SYSUTCDATETIME()
        WHERE CloseRunID = @CloseRunID
      `);
    res.json({ ok: true, closeRunId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to update close run" });
  }
}

export async function updateCloseChecklistItem(req, res) {
  try {
    const itemId = requireUuid("itemId", req.params.itemId);
    const { isComplete, notes } = req.body || {};
    const pool = await poolPromise;
    await pool
      .request()
      .input("ItemID", sql.UniqueIdentifier, itemId)
      .input("IsComplete", sql.Bit, !!isComplete)
      .input("Notes", sql.NVarChar(sql.MAX), notes || "")
      .input("UserID", sql.UniqueIdentifier, req.user?.userId)
      .query(`
        UPDATE dbo.ClientWorkCloseChecklistItems
        SET IsComplete = @IsComplete,
            Notes = @Notes,
            CompletedAt = CASE WHEN @IsComplete = 1 THEN ISNULL(CompletedAt, SYSUTCDATETIME()) ELSE NULL END,
            CompletedByUserID = CASE WHEN @IsComplete = 1 THEN ISNULL(CompletedByUserID, @UserID) ELSE NULL END,
            UpdatedAt = SYSUTCDATETIME()
        WHERE CloseChecklistItemID = @ItemID
      `);
    res.json({ ok: true, itemId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to update checklist item" });
  }
}

function detectCsvHeaderRow(headers) {
  const norm = headers.map((h) => String(h || "").trim().toLowerCase());
  const hasDate = norm.some((h) => h.includes("date"));
  const hasAccount = norm.some((h) => h.includes("account"));
  const hasAmount = norm.some((h) => h.includes("amount") || h.includes("debit") || h.includes("credit"));
  return hasDate && hasAccount && hasAmount;
}

function mapCsvRowToGL(row, headerMap) {
  const get = (key) => {
    const idx = headerMap[key];
    if (idx === undefined) return "";
    return row[idx];
  };
  // Common column names from QBO / exports
  const dateStr = get("date") || get("txn date") || get("transaction date") || get("posting date") || "";
  const account = get("account") || get("account name") || "";
  const vendor = get("vendor") || get("payee") || "";
  const customer = get("customer") || "";
  const clazz = get("class") || "";
  const location = get("location") || "";
  const memo = get("memo") || get("description") || "";

  let amountStr = get("amount") || "";
  const debitStr = get("debit") || "";
  const creditStr = get("credit") || "";
  if (!amountStr && (debitStr || creditStr)) {
    const d = parseFloat(String(debitStr).replace(/[^0-9.-]/g, "")) || 0;
    const c = parseFloat(String(creditStr).replace(/[^0-9.-]/g, "")) || 0;
    amountStr = String(d - c);
  }
  const amount = parseFloat(String(amountStr).replace(/[^0-9.-]/g, ""));
  const txnDate = new Date(dateStr);
  const isValidDate = !Number.isNaN(txnDate.getTime());
  return {
    txnDate: isValidDate ? txnDate.toISOString().slice(0, 10) : null,
    accountName: String(account || "").trim(),
    vendorName: String(vendor || "").trim(),
    customerName: String(customer || "").trim(),
    className: String(clazz || "").trim(),
    locationName: String(location || "").trim(),
    memo: String(memo || "").trim(),
    amount: Number.isFinite(amount) ? amount : null,
  };
}

export async function uploadCloseGL(req, res) {
  try {
    const clientId = requireUuid("clientId", req.body.clientId);
    const periodKey = String(req.body.periodKey || "");
    if (!/^\d{4}-\d{2}$/.test(periodKey)) {
      return res.status(400).json({ error: "periodKey must be YYYY-MM" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "GL file is required" });
    }

    const pool = await poolPromise;

    // Create scan run
    const createScan = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .input("PeriodKey", sql.NVarChar(10), periodKey)
      .input("AsOfDate", sql.Date, req.body.asOfDate ? new Date(req.body.asOfDate) : null)
      .input("CreatedByUserID", sql.UniqueIdentifier, req.user?.userId)
      .input("FileName", sql.NVarChar(255), req.file.originalname)
      .input("FilePath", sql.NVarChar(500), req.file.path)
      .query(`
        DECLARE @id UNIQUEIDENTIFIER = NEWID();
        INSERT INTO dbo.ClientWorkCloseQAScanRuns
          (QAScanRunID, ClientID, PeriodKey, AsOfDate, Status, CreatedByUserID, SourceFileName, SourceFilePath)
        VALUES
          (@id, @ClientID, @PeriodKey, @AsOfDate, 'Draft', @CreatedByUserID, @FileName, @FilePath);
        SELECT @id AS QAScanRunID;
      `);

    const scanRunId = createScan.recordset?.[0]?.QAScanRunID;

    // Parse CSV
    const fileContent = fs.readFileSync(req.file.path, "utf8");
    const records = parseCsv(fileContent, {
      relax_column_count: true,
      skip_empty_lines: true,
    });
    if (!Array.isArray(records) || records.length < 2) {
      return res.status(400).json({ error: "CSV file appears empty or invalid" });
    }

    const header = records[0];
    if (!detectCsvHeaderRow(header)) {
      // If first row doesn't look like headers, we still try to treat it as header
    }
    const headerMap = {};
    header.forEach((h, idx) => {
      const k = String(h || "").trim().toLowerCase();
      if (k) headerMap[k] = idx;
    });

    // Clear previous GL transactions for that client/period (safe re-upload)
    await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .input("PeriodKey", sql.NVarChar(10), periodKey)
      .query(`DELETE FROM dbo.ClientWorkGLTransactions WHERE ClientID = @ClientID AND PeriodKey = @PeriodKey`);

    const insertStmt = `
      INSERT INTO dbo.ClientWorkGLTransactions
        (GLTransactionID, ClientID, PeriodKey, TxnDate, AccountName, VendorName, CustomerName, ClassName, LocationName, Memo, Amount, Source)
      VALUES
        (NEWID(), @ClientID, @PeriodKey, @TxnDate, @AccountName, @VendorName, @CustomerName, @ClassName, @LocationName, @Memo, @Amount, @Source)
    `;

    const maxRows = 20000; // safety
    const rows = records.slice(1, maxRows + 1);
    let inserted = 0;
    for (const r of rows) {
      const mapped = mapCsvRowToGL(r, headerMap);
      if (!mapped.txnDate || !mapped.accountName || mapped.amount === null) continue;

      await pool
        .request()
        .input("ClientID", sql.UniqueIdentifier, clientId)
        .input("PeriodKey", sql.NVarChar(10), periodKey)
        .input("TxnDate", sql.Date, new Date(mapped.txnDate))
        .input("AccountName", sql.NVarChar(255), mapped.accountName)
        .input("VendorName", sql.NVarChar(255), mapped.vendorName || null)
        .input("CustomerName", sql.NVarChar(255), mapped.customerName || null)
        .input("ClassName", sql.NVarChar(255), mapped.className || null)
        .input("LocationName", sql.NVarChar(255), mapped.locationName || null)
        .input("Memo", sql.NVarChar(sql.MAX), mapped.memo || null)
        .input("Amount", sql.Decimal(18, 2), mapped.amount)
        .input("Source", sql.NVarChar(100), "upload")
        .query(insertStmt);
      inserted += 1;
    }

    // Update scan status
    await pool
      .request()
      .input("QAScanRunID", sql.UniqueIdentifier, scanRunId)
      .query(`UPDATE dbo.ClientWorkCloseQAScanRuns SET Status = 'Uploaded', UpdatedAt = SYSUTCDATETIME() WHERE QAScanRunID = @QAScanRunID`);

    res.json({ ok: true, scanRunId, clientId, periodKey, inserted });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to upload GL" });
  }
}

async function getMateriality(clientId, overrides = {}) {
  // Default thresholds; allow per-client override from settings
  const pool = await poolPromise;
  await ensureClientWorkSettings(clientId);
  const s = await pool
    .request()
    .input("ClientID", sql.UniqueIdentifier, clientId)
    .query(`SELECT SettingsJson FROM dbo.ClientWorkSettings WHERE ClientID = @ClientID`);
  const settings = safeJsonParse(s.recordset?.[0]?.SettingsJson, {});
  const materiality = {
    amountThreshold: Number(settings?.closeQa?.materialityAmountThreshold ?? 1000),
    pctThreshold: Number(settings?.closeQa?.materialityPctThreshold ?? 0.3),
    lookbackMonths: Number(settings?.closeQa?.lookbackMonths ?? 3),
    ...overrides,
  };
  return materiality;
}

function groupSum(rows, keyFn) {
  const map = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    const prev = map.get(k) || 0;
    map.set(k, prev + Number(r.Amount || 0));
  }
  return map;
}

function asMoney(n) {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export async function runCloseQAScan(req, res) {
  try {
    const scanRunId = requireUuid("scanRunId", req.body.scanRunId);
    const overrides = req.body.overrides || {};

    const pool = await poolPromise;

    // Get scan run
    const scan = await pool
      .request()
      .input("QAScanRunID", sql.UniqueIdentifier, scanRunId)
      .query(`SELECT ClientID, PeriodKey FROM dbo.ClientWorkCloseQAScanRuns WHERE QAScanRunID = @QAScanRunID`);
    const row = scan.recordset?.[0];
    if (!row) return res.status(404).json({ error: "Scan run not found" });
    const clientId = row.ClientID;
    const periodKey = row.PeriodKey;

    const { amountThreshold, pctThreshold, lookbackMonths } = await getMateriality(clientId, overrides);

    // Load current period GL
    const currentRes = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .input("PeriodKey", sql.NVarChar(10), periodKey)
      .query(`
        SELECT TxnDate, AccountName, VendorName, CustomerName, Amount, Memo
        FROM dbo.ClientWorkGLTransactions
        WHERE ClientID = @ClientID AND PeriodKey = @PeriodKey
      `);
    const current = currentRes.recordset || [];

    // Load prior periods GL (lookback)
    const priorPeriodKeys = [];
    {
      const [y, m] = periodKey.split("-").map((x) => Number(x));
      let yy = y;
      let mm = m;
      for (let i = 1; i <= lookbackMonths; i += 1) {
        mm -= 1;
        if (mm <= 0) {
          mm += 12;
          yy -= 1;
        }
        priorPeriodKeys.push(`${yy}-${String(mm).padStart(2, "0")}`);
      }
    }

    let prior = [];
    if (priorPeriodKeys.length > 0) {
      const r = pool.request().input("ClientID", sql.UniqueIdentifier, clientId);
      priorPeriodKeys.forEach((k, i) => r.input(`p${i}`, sql.NVarChar(10), k));
      const inClause = priorPeriodKeys.map((_, i) => `@p${i}`).join(",");
      const q = `
        SELECT PeriodKey, TxnDate, AccountName, VendorName, CustomerName, Amount
        FROM dbo.ClientWorkGLTransactions
        WHERE ClientID = @ClientID AND PeriodKey IN (${inClause})
      `;
      const priorQueryRes = await r.query(q);
      prior = priorQueryRes.recordset || [];
    }

    // Clear previous flags
    await pool
      .request()
      .input("QAScanRunID", sql.UniqueIdentifier, scanRunId)
      .query(`DELETE FROM dbo.ClientWorkCloseQAFlags WHERE QAScanRunID = @QAScanRunID`);

    const flags = [];

    // Rule 1: Negative revenue
    for (const tx of current) {
      const acct = String(tx.AccountName || "").toLowerCase();
      if (acct.includes("revenue") && Number(tx.Amount) < 0) {
        flags.push({
          severity: "Critical",
          category: "Negative revenue",
          description: `Negative revenue entry in ${tx.AccountName}: ${asMoney(Number(tx.Amount))}`,
          suggestedFix: "Review transaction coding and invoice/credit memo application. Confirm correct revenue account and period.",
          accountName: tx.AccountName,
          vendorName: tx.VendorName,
          customerName: tx.CustomerName,
          txnDate: tx.TxnDate,
          amount: Number(tx.Amount),
        });
      }
    }

    // Aggregate by account for variance checks
    const currentByAccount = groupSum(current, (r) => r.AccountName);
    const priorByAccount = new Map();
    for (const p of prior) {
      const k = p.AccountName;
      const prev = priorByAccount.get(k) || [];
      prev.push(Number(p.Amount || 0));
      priorByAccount.set(k, prev);
    }

    // Rule 2: Account spikes (vs avg of lookback)
    for (const [acct, curSum] of currentByAccount.entries()) {
      const arr = prior.filter((p) => p.AccountName === acct);
      if (!arr.length) continue;
      const avg = arr.reduce((s, r) => s + Number(r.Amount || 0), 0) / lookbackMonths;
      const delta = curSum - avg;
      const pct = avg !== 0 ? Math.abs(delta / avg) : 1;
      if (Math.abs(delta) >= amountThreshold && pct >= pctThreshold) {
        flags.push({
          severity: "Warning",
          category: "Unusual spike",
          description: `Account ${acct} variance vs ${lookbackMonths}m avg: ${asMoney(curSum)} vs avg ${asMoney(avg)} (Δ ${asMoney(delta)})`,
          suggestedFix: "Drill into GL detail for the account to identify drivers (one-time vs recurring, miscoding, missing entries).",
          accountName: acct,
          txnDate: null,
          amount: delta,
        });
      }
    }

    // Rule 3: Vendor miscoding (vendor appears in different account than usual)
    // Compute vendor → most common account in lookback
    const vendorAccountCounts = new Map();
    for (const p of prior) {
      const vendor = String(p.VendorName || "").trim();
      if (!vendor) continue;
      const key = vendor;
      const map = vendorAccountCounts.get(key) || new Map();
      const acct = String(p.AccountName || "").trim();
      map.set(acct, (map.get(acct) || 0) + 1);
      vendorAccountCounts.set(key, map);
    }
    const vendorPrimaryAccount = new Map();
    for (const [vendor, m] of vendorAccountCounts.entries()) {
      let best = null;
      let bestCnt = 0;
      for (const [acct, cnt] of m.entries()) {
        if (cnt > bestCnt) {
          bestCnt = cnt;
          best = acct;
        }
      }
      if (best) vendorPrimaryAccount.set(vendor, best);
    }
    for (const tx of current) {
      const vendor = String(tx.VendorName || "").trim();
      if (!vendor) continue;
      const expected = vendorPrimaryAccount.get(vendor);
      if (expected && expected !== tx.AccountName) {
        flags.push({
          severity: "Warning",
          category: "Vendor coded to unusual account",
          description: `Vendor ${vendor} coded to ${tx.AccountName} (historically: ${expected})`,
          suggestedFix: "Confirm correct account mapping for this vendor and reclassify if needed.",
          accountName: tx.AccountName,
          vendorName: vendor,
          txnDate: tx.TxnDate,
          amount: Number(tx.Amount),
        });
      }
    }

    // Rule 4: Missing recurring vendor expense
    // Determine vendors that posted last month or >=3 of last 5 months, but not current.
    const currentVendors = new Set(current.map((t) => String(t.VendorName || "").trim()).filter(Boolean));
    const priorVendorMonths = new Map();
    for (const p of prior) {
      const v = String(p.VendorName || "").trim();
      if (!v) continue;
      const set = priorVendorMonths.get(v) || new Set();
      set.add(p.PeriodKey);
      priorVendorMonths.set(v, set);
    }
    for (const [v, set] of priorVendorMonths.entries()) {
      const monthsCount = set.size;
      const postedLastMonth = set.has(priorPeriodKeys[0]);
      if ((postedLastMonth || monthsCount >= 3) && !currentVendors.has(v)) {
        flags.push({
          severity: "Warning",
          category: "Missing recurring expense",
          description: `Vendor ${v} posted in prior periods (${[...set].sort().join(", ")}) but is missing in ${periodKey}`,
          suggestedFix: "Confirm if vendor contract ended (meeting notes) or if transaction is missing / misdated. Add or reclassify as needed.",
          vendorName: v,
          amount: null,
        });
      }
    }

    // Persist flags
    for (const f of flags) {
      await pool
        .request()
        .input("FlagID", sql.UniqueIdentifier, undefined)
        .input("QAScanRunID", sql.UniqueIdentifier, scanRunId)
        .input("Severity", sql.NVarChar(20), f.severity)
        .input("Category", sql.NVarChar(100), f.category)
        .input("Description", sql.NVarChar(sql.MAX), f.description)
        .input("SuggestedFix", sql.NVarChar(sql.MAX), f.suggestedFix)
        .input("AccountName", sql.NVarChar(255), f.accountName || null)
        .input("VendorName", sql.NVarChar(255), f.vendorName || null)
        .input("CustomerName", sql.NVarChar(255), f.customerName || null)
        .input("TxnDate", sql.Date, f.txnDate ? new Date(f.txnDate) : null)
        .input("Amount", sql.Decimal(18, 2), Number.isFinite(f.amount) ? f.amount : null)
        .query(`
          INSERT INTO dbo.ClientWorkCloseQAFlags
            (CloseQAFlagID, QAScanRunID, Severity, Category, Description, SuggestedFix, AccountName, VendorName, CustomerName, TxnDate, Amount)
          VALUES
            (NEWID(), @QAScanRunID, @Severity, @Category, @Description, @SuggestedFix, @AccountName, @VendorName, @CustomerName, @TxnDate, @Amount)
        `);
    }

    await pool
      .request()
      .input("QAScanRunID", sql.UniqueIdentifier, scanRunId)
      .query(`UPDATE dbo.ClientWorkCloseQAScanRuns SET Status = 'Completed', UpdatedAt = SYSUTCDATETIME() WHERE QAScanRunID = @QAScanRunID`);

    res.json({ ok: true, scanRunId, flagsCreated: flags.length, thresholds: { amountThreshold, pctThreshold, lookbackMonths } });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to run QA scan" });
  }
}

export async function listCloseQAFlags(req, res) {
  try {
    const scanRunId = req.query.scanRunId ? requireUuid("scanRunId", req.query.scanRunId) : null;
    const clientId = req.query.clientId ? requireUuid("clientId", req.query.clientId) : null;
    const periodKey = req.query.periodKey ? String(req.query.periodKey) : null;

    const pool = await poolPromise;
    if (scanRunId) {
      const r = await pool
        .request()
        .input("QAScanRunID", sql.UniqueIdentifier, scanRunId)
        .query(`
          SELECT CloseQAFlagID, Severity, Category, Description, SuggestedFix, AccountName, VendorName, CustomerName, TxnDate, Amount,
                 Status, ReviewerUserID, ReviewerNotes, ResolutionNotes, CreatedAt, UpdatedAt
          FROM dbo.ClientWorkCloseQAFlags
          WHERE QAScanRunID = @QAScanRunID
          ORDER BY Severity DESC, CreatedAt DESC
        `);
      return res.json({ scanRunId, flags: r.recordset || [] });
    }

    if (clientId && periodKey) {
      const r = await pool
        .request()
        .input("ClientID", sql.UniqueIdentifier, clientId)
        .input("PeriodKey", sql.NVarChar(10), periodKey)
        .query(`
          SELECT f.CloseQAFlagID, f.Severity, f.Category, f.Description, f.SuggestedFix, f.AccountName, f.VendorName, f.CustomerName, f.TxnDate, f.Amount,
                 f.Status, f.ReviewerUserID, f.ReviewerNotes, f.ResolutionNotes, f.CreatedAt, f.UpdatedAt
          FROM dbo.ClientWorkCloseQAFlags f
          JOIN dbo.ClientWorkCloseQAScanRuns r ON r.QAScanRunID = f.QAScanRunID
          WHERE r.ClientID = @ClientID AND r.PeriodKey = @PeriodKey
          ORDER BY f.Severity DESC, f.CreatedAt DESC
        `);
      return res.json({ clientId, periodKey, flags: r.recordset || [] });
    }

    return res.status(400).json({ error: "Provide scanRunId OR (clientId + periodKey)" });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to list QA flags" });
  }
}

export async function updateCloseQAFlag(req, res) {
  try {
    const flagId = requireUuid("flagId", req.params.flagId);
    const { status, reviewerNotes, resolutionNotes } = req.body || {};
    const pool = await poolPromise;
    await pool
      .request()
      .input("FlagID", sql.UniqueIdentifier, flagId)
      .input("Status", sql.NVarChar(50), status || "Open")
      .input("ReviewerUserID", sql.UniqueIdentifier, req.user?.userId)
      .input("ReviewerNotes", sql.NVarChar(sql.MAX), reviewerNotes || "")
      .input("ResolutionNotes", sql.NVarChar(sql.MAX), resolutionNotes || "")
      .query(`
        UPDATE dbo.ClientWorkCloseQAFlags
        SET Status = @Status,
            ReviewerUserID = @ReviewerUserID,
            ReviewerNotes = @ReviewerNotes,
            ResolutionNotes = @ResolutionNotes,
            UpdatedAt = SYSUTCDATETIME()
        WHERE CloseQAFlagID = @FlagID
      `);
    res.json({ ok: true, flagId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to update flag" });
  }
}

// -------------------------------
// Cash Forecast (13-week)
// -------------------------------

async function getOrCreateCashForecast(clientId, scenarioName, startWeekEndingDate, createdByUserId) {
  const pool = await poolPromise;
  const start = normalizeWeekEndingFriday(startWeekEndingDate);

  const existing = await pool
    .request()
    .input("ClientID", sql.UniqueIdentifier, clientId)
    .input("ScenarioName", sql.NVarChar(50), scenarioName)
    .query(`
      SELECT TOP 1 CashForecastID, StartWeekEndingDate, StartingCashBalanceOverride, StartingLiquidityAvailable,
             WarningCashThreshold, CriticalCashThreshold
      FROM dbo.ClientWorkCashForecasts
      WHERE ClientID = @ClientID AND ScenarioName = @ScenarioName
      ORDER BY UpdatedAt DESC
    `);

  if (existing.recordset?.[0]) return existing.recordset[0];

  const created = await pool
    .request()
    .input("ClientID", sql.UniqueIdentifier, clientId)
    .input("ScenarioName", sql.NVarChar(50), scenarioName)
    .input("StartWeekEndingDate", sql.Date, new Date(start))
    .input("CreatedByUserID", sql.UniqueIdentifier, createdByUserId)
    .query(`
      DECLARE @id UNIQUEIDENTIFIER = NEWID();
      INSERT INTO dbo.ClientWorkCashForecasts
        (CashForecastID, ClientID, ScenarioName, StartWeekEndingDate, Status, CreatedByUserID, StartingCashBalanceOverride, StartingLiquidityAvailable,
         WarningCashThreshold, CriticalCashThreshold)
      VALUES
        (@id, @ClientID, @ScenarioName, @StartWeekEndingDate, 'Draft', @CreatedByUserID, NULL, NULL, NULL, NULL);
      SELECT @id AS CashForecastID, @StartWeekEndingDate AS StartWeekEndingDate;
    `);

  return { CashForecastID: created.recordset?.[0]?.CashForecastID, StartWeekEndingDate: start };
}

export async function getCashForecast(req, res) {
  try {
    const clientId = requireUuid("clientId", req.query.clientId);
    const scenarioName = String(req.query.scenarioName || "Base");
    const startWeekEndingDate = req.query.startWeekEndingDate ? String(req.query.startWeekEndingDate) : new Date().toISOString().slice(0, 10);

    const forecast = await getOrCreateCashForecast(clientId, scenarioName, startWeekEndingDate, req.user?.userId);
    const cashForecastId = forecast.CashForecastID;
    const start = normalizeWeekEndingFriday(forecast.StartWeekEndingDate || startWeekEndingDate);

    const pool = await poolPromise;
    const linesRes = await pool
      .request()
      .input("CashForecastID", sql.UniqueIdentifier, cashForecastId)
      .query(`
        SELECT CashForecastLineID, WeekEndingDate, LineType, Direction, CounterpartyType, CounterpartyName,
               Amount, Notes, ClientNote, HasClientNote, CreatedAt, UpdatedAt
        FROM dbo.ClientWorkCashForecastLines
        WHERE CashForecastID = @CashForecastID
        ORDER BY WeekEndingDate ASC, CreatedAt ASC
      `);
    const lines = linesRes.recordset || [];

    // Build 13 weeks (Friday-ending)
    const weeks = [];
    let opening = forecast.StartingCashBalanceOverride != null ? Number(forecast.StartingCashBalanceOverride) : null;
    const warning = forecast.WarningCashThreshold != null ? Number(forecast.WarningCashThreshold) : null;
    const critical = forecast.CriticalCashThreshold != null ? Number(forecast.CriticalCashThreshold) : null;

    // If no starting cash, compute 0 (UI will prompt)
    if (opening === null) opening = 0;

    for (let i = 0; i < 13; i += 1) {
      const weekEnding = addDays(start, i * 7);
      const weekLines = lines.filter((l) => String(l.WeekEndingDate).slice(0, 10) === weekEnding);
      const inflows = weekLines.filter((l) => l.Direction === "Inflow").reduce((s, l) => s + Number(l.Amount || 0), 0);
      const outflows = weekLines.filter((l) => l.Direction === "Outflow").reduce((s, l) => s + Number(l.Amount || 0), 0);
      const ending = opening + inflows - outflows;
      const status = critical != null && ending <= critical ? "Critical" : warning != null && ending <= warning ? "Warning" : "OK";
      weeks.push({ weekEnding, openingCash: opening, inflows, outflows, endingCash: ending, status });
      opening = ending;
    }

    res.json({
      clientId,
      scenarioName,
      cashForecastId,
      startWeekEndingDate: start,
      startingCashBalanceOverride: forecast.StartingCashBalanceOverride,
      startingLiquidityAvailable: forecast.StartingLiquidityAvailable,
      warningCashThreshold: warning,
      criticalCashThreshold: critical,
      weeks,
      lines,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to get cash forecast" });
  }
}

export async function updateCashForecastHeader(req, res) {
  try {
    const cashForecastId = requireUuid("cashForecastId", req.params.cashForecastId);
    const {
      startingCashBalanceOverride,
      startingLiquidityAvailable,
      warningCashThreshold,
      criticalCashThreshold,
      status,
    } = req.body || {};

    const pool = await poolPromise;
    await pool
      .request()
      .input("CashForecastID", sql.UniqueIdentifier, cashForecastId)
      .input("StartingCashBalanceOverride", sql.Decimal(18, 2), startingCashBalanceOverride != null ? Number(startingCashBalanceOverride) : null)
      .input("StartingLiquidityAvailable", sql.Decimal(18, 2), startingLiquidityAvailable != null ? Number(startingLiquidityAvailable) : null)
      .input("WarningCashThreshold", sql.Decimal(18, 2), warningCashThreshold != null ? Number(warningCashThreshold) : null)
      .input("CriticalCashThreshold", sql.Decimal(18, 2), criticalCashThreshold != null ? Number(criticalCashThreshold) : null)
      .input("Status", sql.NVarChar(50), status || "Draft")
      .query(`
        UPDATE dbo.ClientWorkCashForecasts
        SET StartingCashBalanceOverride = @StartingCashBalanceOverride,
            StartingLiquidityAvailable = @StartingLiquidityAvailable,
            WarningCashThreshold = @WarningCashThreshold,
            CriticalCashThreshold = @CriticalCashThreshold,
            Status = @Status,
            UpdatedAt = SYSUTCDATETIME()
        WHERE CashForecastID = @CashForecastID
      `);
    res.json({ ok: true, cashForecastId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to update cash forecast header" });
  }
}

export async function upsertCashForecastLine(req, res) {
  try {
    const {
      cashForecastId,
      weekEndingDate,
      lineType,
      direction,
      counterpartyType,
      counterpartyName,
      amount,
      notes,
      clientNote,
    } = req.body || {};
    const cfId = requireUuid("cashForecastId", cashForecastId);
    const wk = normalizeWeekEndingFriday(String(weekEndingDate));

    const pool = await poolPromise;
    const id = req.body.cashForecastLineId && isUuid(req.body.cashForecastLineId) ? req.body.cashForecastLineId : null;

    if (!id) {
      const create = await pool
        .request()
        .input("CashForecastID", sql.UniqueIdentifier, cfId)
        .input("WeekEndingDate", sql.Date, new Date(wk))
        .input("LineType", sql.NVarChar(50), lineType || "Other")
        .input("Direction", sql.NVarChar(20), direction || "Outflow")
        .input("CounterpartyType", sql.NVarChar(50), counterpartyType || null)
        .input("CounterpartyName", sql.NVarChar(255), counterpartyName || null)
        .input("Amount", sql.Decimal(18, 2), Number(amount || 0))
        .input("Notes", sql.NVarChar(sql.MAX), notes || null)
        .input("ClientNote", sql.NVarChar(sql.MAX), clientNote || null)
        .input("HasClientNote", sql.Bit, !!clientNote)
        .input("CreatedByUserID", sql.UniqueIdentifier, req.user?.userId)
        .query(`
          DECLARE @id UNIQUEIDENTIFIER = NEWID();
          INSERT INTO dbo.ClientWorkCashForecastLines
            (CashForecastLineID, CashForecastID, WeekEndingDate, LineType, Direction, CounterpartyType, CounterpartyName,
             Amount, Notes, ClientNote, HasClientNote, CreatedByUserID)
          VALUES
            (@id, @CashForecastID, @WeekEndingDate, @LineType, @Direction, @CounterpartyType, @CounterpartyName,
             @Amount, @Notes, @ClientNote, @HasClientNote, @CreatedByUserID);
          SELECT @id AS CashForecastLineID;
        `);
      return res.json({ ok: true, cashForecastLineId: create.recordset?.[0]?.CashForecastLineID });
    }

    await pool
      .request()
      .input("LineID", sql.UniqueIdentifier, id)
      .input("WeekEndingDate", sql.Date, new Date(wk))
      .input("LineType", sql.NVarChar(50), lineType || "Other")
      .input("Direction", sql.NVarChar(20), direction || "Outflow")
      .input("CounterpartyType", sql.NVarChar(50), counterpartyType || null)
      .input("CounterpartyName", sql.NVarChar(255), counterpartyName || null)
      .input("Amount", sql.Decimal(18, 2), Number(amount || 0))
      .input("Notes", sql.NVarChar(sql.MAX), notes || null)
      .input("ClientNote", sql.NVarChar(sql.MAX), clientNote || null)
      .input("HasClientNote", sql.Bit, !!clientNote)
      .query(`
        UPDATE dbo.ClientWorkCashForecastLines
        SET WeekEndingDate = @WeekEndingDate,
            LineType = @LineType,
            Direction = @Direction,
            CounterpartyType = @CounterpartyType,
            CounterpartyName = @CounterpartyName,
            Amount = @Amount,
            Notes = @Notes,
            ClientNote = @ClientNote,
            HasClientNote = @HasClientNote,
            UpdatedAt = SYSUTCDATETIME()
        WHERE CashForecastLineID = @LineID
      `);
    res.json({ ok: true, cashForecastLineId: id });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to upsert cash forecast line" });
  }
}

export async function deleteCashForecastLine(req, res) {
  try {
    const lineId = requireUuid("lineId", req.params.lineId);
    const pool = await poolPromise;
    await pool.request().input("LineID", sql.UniqueIdentifier, lineId).query(`DELETE FROM dbo.ClientWorkCashForecastLines WHERE CashForecastLineID = @LineID`);
    res.json({ ok: true, lineId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to delete cash forecast line" });
  }
}

// -------------------------------
// AI Reporting Engine (draft/publish/lock)
// -------------------------------

async function callChatGPT({ system, user, model = "gpt-4o-mini" }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "OPENAI_API_KEY is not set" };
  }
  const baseURL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  try {
    const resp = await axios.post(
      `${baseURL}/chat/completions`,
      {
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );
    const content = resp.data?.choices?.[0]?.message?.content || "";
    return { ok: true, content };
  } catch (e) {
    return { ok: false, error: e?.response?.data?.error?.message || e.message || "OpenAI call failed" };
  }
}

function buildAiPrompt({ clientName, periodKey, asOfDate, inputs }) {
  const safety = `You are a CFO/Controller assistant. You MUST NOT invent or hallucinate numbers. Use ONLY numbers explicitly provided in the input JSON. If a needed number is missing, write "[NEEDS INPUT]" and a short note describing what is missing. Keep questions to a minimum; prioritize concise what/why/action. Output must be valid JSON with keys: summaryEmail, pages (array), forwardLook.`;
  const user = `Client: ${clientName}\nPeriod: ${periodKey}\nAs of: ${asOfDate || "(not provided)"}\n\nINPUT JSON (only source of truth for numbers):\n${JSON.stringify(inputs || {}, null, 2)}`;
  return { system: safety, user };
}

function fallbackAiDraft({ clientName, periodKey, inputs }) {
  // Basic deterministic draft when AI is disabled.
  const revenue = inputs?.revenue;
  const gp = inputs?.grossProfit;
  const ebitda = inputs?.ebitda;
  const summaryEmail = `Reporting package for ${periodKey} attached.\n\nRevenue: ${revenue ? JSON.stringify(revenue) : "[NEEDS INPUT]"}\nGross Profit: ${gp ? JSON.stringify(gp) : "[NEEDS INPUT]"}\nEBITDA: ${ebitda ? JSON.stringify(ebitda) : "[NEEDS INPUT]"}\n\nTop priorities: [NEEDS INPUT]`;
  return {
    summaryEmail,
    pages: [
      {
        pageKey: "IncomeStatement",
        opener: `For ${periodKey}, key income statement highlights are summarized below for ${clientName}.`,
        bullets: ["[NEEDS INPUT]"],
        takeaway: "[NEEDS INPUT]",
      },
    ],
    forwardLook: {
      opener: "Forward look (MTD + next month vs budget):",
      bullets: ["[NEEDS INPUT]"],
      takeaway: "[NEEDS INPUT]",
    },
  };
}

export async function createAiRun(req, res) {
  try {
    const { clientId, periodKey, asOfDate, inputs } = req.body || {};
    requireUuid("clientId", clientId);
    if (!/^\d{4}-\d{2}$/.test(String(periodKey))) return res.status(400).json({ error: "periodKey must be YYYY-MM" });

    const pool = await poolPromise;
    const idRes = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .input("PeriodKey", sql.NVarChar(10), String(periodKey))
      .input("AsOfDate", sql.Date, asOfDate ? new Date(asOfDate) : null)
      .input("CreatedByUserID", sql.UniqueIdentifier, req.user?.userId)
      .input("InputsJson", sql.NVarChar(sql.MAX), JSON.stringify(inputs || {}))
      .query(`
        DECLARE @id UNIQUEIDENTIFIER = NEWID();
        INSERT INTO dbo.ClientWorkAIRuns (AIRunID, ClientID, PeriodKey, AsOfDate, Status, CreatedByUserID, InputsJson)
        VALUES (@id, @ClientID, @PeriodKey, @AsOfDate, 'Draft', @CreatedByUserID, @InputsJson);
        SELECT @id AS AIRunID;
      `);
    res.json({ ok: true, aiRunId: idRes.recordset?.[0]?.AIRunID });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to create AI run" });
  }
}

export async function listAiRuns(req, res) {
  try {
    const clientId = requireUuid("clientId", req.query.clientId);
    const pool = await poolPromise;
    const r = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .query(`
        SELECT TOP 50 AIRunID, PeriodKey, AsOfDate, Status, PublishedAt, LockedAt, UpdatedAt
        FROM dbo.ClientWorkAIRuns
        WHERE ClientID = @ClientID
        ORDER BY UpdatedAt DESC
      `);
    res.json({ clientId, runs: r.recordset || [] });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to list AI runs" });
  }
}

export async function getAiRun(req, res) {
  try {
    const aiRunId = requireUuid("aiRunId", req.params.aiRunId);
    const pool = await poolPromise;
    const r = await pool
      .request()
      .input("AIRunID", sql.UniqueIdentifier, aiRunId)
      .query(`
        SELECT AIRunID, ClientID, PeriodKey, AsOfDate, Status, InputsJson, OutputJson, OutputEmailText, UpdatedAt, PublishedAt, LockedAt
        FROM dbo.ClientWorkAIRuns
        WHERE AIRunID = @AIRunID
      `);
    const row = r.recordset?.[0];
    if (!row) return res.status(404).json({ error: "AI run not found" });
    res.json({
      aiRunId,
      clientId: row.ClientID,
      periodKey: row.PeriodKey,
      asOfDate: row.AsOfDate,
      status: row.Status,
      inputs: safeJsonParse(row.InputsJson, {}),
      output: safeJsonParse(row.OutputJson, null),
      outputEmailText: row.OutputEmailText || "",
      updatedAt: row.UpdatedAt,
      publishedAt: row.PublishedAt,
      lockedAt: row.LockedAt,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to get AI run" });
  }
}

export async function generateAiRun(req, res) {
  try {
    const aiRunId = requireUuid("aiRunId", req.params.aiRunId);
    const pool = await poolPromise;
    const r = await pool
      .request()
      .input("AIRunID", sql.UniqueIdentifier, aiRunId)
      .query(`SELECT ClientID, PeriodKey, AsOfDate, InputsJson FROM dbo.ClientWorkAIRuns WHERE AIRunID = @AIRunID`);
    const row = r.recordset?.[0];
    if (!row) return res.status(404).json({ error: "AI run not found" });

    const clientId = row.ClientID;
    const periodKey = row.PeriodKey;
    const asOfDate = row.AsOfDate ? new Date(row.AsOfDate).toISOString().slice(0, 10) : null;
    const inputs = safeJsonParse(row.InputsJson, {});
    const clientName = await getClientName(clientId);

    // Per-client toggle to disable AI
    await ensureClientWorkSettings(clientId);
    const settingsRow = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .query(`SELECT SettingsJson FROM dbo.ClientWorkSettings WHERE ClientID = @ClientID`);
    const settings = safeJsonParse(settingsRow.recordset?.[0]?.SettingsJson, {});
    const aiEnabled = settings?.aiReporting?.enabled !== false; // default on

    let draft;
    if (!aiEnabled) {
      draft = fallbackAiDraft({ clientName, periodKey, inputs });
    } else {
      const { system, user } = buildAiPrompt({ clientName, periodKey, asOfDate, inputs });
      const model = settings?.aiReporting?.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
      const resp = await callChatGPT({ system, user, model });
      if (!resp.ok) {
        draft = fallbackAiDraft({ clientName, periodKey, inputs });
        draft._aiError = resp.error;
      } else {
        // Try to parse JSON; fallback to wrapping
        const parsed = safeJsonParse(resp.content, null);
        draft = parsed || { raw: resp.content };
      }
    }

    await pool
      .request()
      .input("AIRunID", sql.UniqueIdentifier, aiRunId)
      .input("OutputJson", sql.NVarChar(sql.MAX), JSON.stringify(draft))
      .input("OutputEmailText", sql.NVarChar(sql.MAX), draft?.summaryEmail ? String(draft.summaryEmail) : null)
      .query(`
        UPDATE dbo.ClientWorkAIRuns
        SET OutputJson = @OutputJson,
            OutputEmailText = @OutputEmailText,
            UpdatedAt = SYSUTCDATETIME()
        WHERE AIRunID = @AIRunID
      `);

    res.json({ ok: true, aiRunId, draft });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to generate AI output" });
  }
}

export async function updateAiRun(req, res) {
  try {
    const aiRunId = requireUuid("aiRunId", req.params.aiRunId);
    const { output, outputEmailText } = req.body || {};
    const pool = await poolPromise;
    await pool
      .request()
      .input("AIRunID", sql.UniqueIdentifier, aiRunId)
      .input("OutputJson", sql.NVarChar(sql.MAX), output ? JSON.stringify(output) : null)
      .input("OutputEmailText", sql.NVarChar(sql.MAX), outputEmailText || null)
      .query(`
        UPDATE dbo.ClientWorkAIRuns
        SET OutputJson = ISNULL(@OutputJson, OutputJson),
            OutputEmailText = ISNULL(@OutputEmailText, OutputEmailText),
            UpdatedAt = SYSUTCDATETIME()
        WHERE AIRunID = @AIRunID AND Status <> 'Locked'
      `);
    res.json({ ok: true, aiRunId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to update AI run" });
  }
}

export async function publishAiRun(req, res) {
  try {
    const aiRunId = requireUuid("aiRunId", req.params.aiRunId);
    const pool = await poolPromise;
    await pool
      .request()
      .input("AIRunID", sql.UniqueIdentifier, aiRunId)
      .input("UserID", sql.UniqueIdentifier, req.user?.userId)
      .query(`
        UPDATE dbo.ClientWorkAIRuns
        SET Status = 'Published', PublishedAt = SYSUTCDATETIME(), PublishedByUserID = @UserID, UpdatedAt = SYSUTCDATETIME()
        WHERE AIRunID = @AIRunID AND Status <> 'Locked'
      `);
    res.json({ ok: true, aiRunId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to publish AI run" });
  }
}

export async function lockAiRun(req, res) {
  try {
    const aiRunId = requireUuid("aiRunId", req.params.aiRunId);
    const pool = await poolPromise;
    await pool
      .request()
      .input("AIRunID", sql.UniqueIdentifier, aiRunId)
      .input("UserID", sql.UniqueIdentifier, req.user?.userId)
      .query(`
        UPDATE dbo.ClientWorkAIRuns
        SET Status = 'Locked', LockedAt = SYSUTCDATETIME(), LockedByUserID = @UserID, UpdatedAt = SYSUTCDATETIME()
        WHERE AIRunID = @AIRunID
      `);
    res.json({ ok: true, aiRunId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to lock AI run" });
  }
}

// -------------------------------
// Market Intelligence (GDELT-based MVP)
// -------------------------------

async function fetchGdeltArticles({ query, maxRecords = 25 }) {
  // GDELT Doc 2.1
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&format=json&maxrecords=${maxRecords}&sort=HybridRel`;
  const resp = await axios.get(url, { timeout: 30000 });
  const articles = resp.data?.articles || [];
  return articles.map((a) => ({
    title: a.title,
    url: a.url,
    source: a.sourceCountry || a.sourceCollection || "",
    domain: a.domain || "",
    seendate: a.seendate,
    language: a.language,
  }));
}

export async function refreshMarketIntel(req, res) {
  try {
    const { clientId, overrideCap } = req.body || {};
    requireUuid("clientId", clientId);
    const pool = await poolPromise;

    // Cap: default 10 runs per month, admin override
    const cap = 10;
    const monthKey = toPeriodKey(new Date());
    const countRes = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .input("MonthKey", sql.NVarChar(10), monthKey)
      .query(`
        SELECT COUNT(1) AS Cnt
        FROM dbo.ClientWorkMarketIntelRuns
        WHERE ClientID = @ClientID AND LEFT(CONVERT(VARCHAR(10), RunAt, 120), 7) = @MonthKey
      `);
    const cnt = countRes.recordset?.[0]?.Cnt || 0;
    const isAdmin = (req.user?.roles || []).includes("Admin");
    if (cnt >= cap && !(overrideCap && isAdmin)) {
      return res.status(429).json({ error: `Monthly run cap (${cap}) reached for this client. Admin override available.` });
    }

    await ensureClientWorkSettings(clientId);
    const settingsRes = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .query(`SELECT SettingsJson FROM dbo.ClientWorkSettings WHERE ClientID = @ClientID`);
    const settings = safeJsonParse(settingsRes.recordset?.[0]?.SettingsJson, {});

    const clientName = await getClientName(clientId);
    const industry = settings?.marketIntel?.industry || "";
    const geography = settings?.marketIntel?.geography || "";
    const competitors = Array.isArray(settings?.marketIntel?.competitors) ? settings.marketIntel.competitors : [];

    // Weighted query: client name + industry + geography + competitors
    const pieces = [
      `"${clientName}"`,
      industry ? `(${industry})` : "",
      geography ? `(${geography})` : "",
      competitors.length ? `(${competitors.slice(0, 5).map((c) => `"${c}"`).join(" OR ")})` : "",
      "(acquisition OR merger OR valuation OR competitor OR pricing OR market OR regulation)",
    ].filter(Boolean);
    const query = pieces.join(" AND ");

    const articles = await fetchGdeltArticles({ query, maxRecords: 30 });

    const runIdRes = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .input("RunAt", sql.DateTime2, new Date())
      .input("CreatedByUserID", sql.UniqueIdentifier, req.user?.userId)
      .input("QueryJson", sql.NVarChar(sql.MAX), JSON.stringify({ query, pieces, clientName, industry, geography, competitors }))
      .query(`
        DECLARE @id UNIQUEIDENTIFIER = NEWID();
        INSERT INTO dbo.ClientWorkMarketIntelRuns (MarketIntelRunID, ClientID, RunAt, CreatedByUserID, QueryJson, Status)
        VALUES (@id, @ClientID, @RunAt, @CreatedByUserID, @QueryJson, 'Completed');
        SELECT @id AS MarketIntelRunID;
      `);
    const runId = runIdRes.recordset?.[0]?.MarketIntelRunID;

    let inserted = 0;
    for (const a of articles) {
      if (!a.url) continue;
      // Dedup by URL
      const exists = await pool
        .request()
        .input("ClientID", sql.UniqueIdentifier, clientId)
        .input("Url", sql.NVarChar(1000), a.url)
        .query(`SELECT TOP 1 MarketIntelItemID FROM dbo.ClientWorkMarketIntelItems WHERE ClientID = @ClientID AND Url = @Url`);
      if (exists.recordset?.[0]) continue;

      await pool
        .request()
        .input("RunID", sql.UniqueIdentifier, runId)
        .input("ClientID", sql.UniqueIdentifier, clientId)
        .input("PublishedAt", sql.DateTime2, a.seendate ? new Date(a.seendate) : new Date())
        .input("Title", sql.NVarChar(500), a.title || "")
        .input("Source", sql.NVarChar(255), a.domain || a.source || "")
        .input("Url", sql.NVarChar(1000), a.url)
        .input("Category", sql.NVarChar(100), "News")
        .query(`
          INSERT INTO dbo.ClientWorkMarketIntelItems
            (MarketIntelItemID, MarketIntelRunID, ClientID, PublishedAt, Title, Source, Url, Category, IsPinned)
          VALUES
            (NEWID(), @RunID, @ClientID, @PublishedAt, @Title, @Source, @Url, @Category, 0)
        `);
      inserted += 1;
    }

    res.json({ ok: true, runId, query, inserted });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to refresh market intelligence" });
  }
}

export async function listMarketIntelItems(req, res) {
  try {
    const clientId = requireUuid("clientId", req.query.clientId);
    const pool = await poolPromise;
    const r = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .query(`
        SELECT TOP 200 MarketIntelItemID, PublishedAt, Title, Source, Url, Category, IsPinned, Tags, Summary, CreatedAt
        FROM dbo.ClientWorkMarketIntelItems
        WHERE ClientID = @ClientID
        ORDER BY IsPinned DESC, PublishedAt DESC
      `);
    res.json({ clientId, items: r.recordset || [] });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to list market intelligence items" });
  }
}

export async function pinMarketIntelItem(req, res) {
  try {
    const itemId = requireUuid("itemId", req.params.itemId);
    const { isPinned } = req.body || {};
    const pool = await poolPromise;
    await pool
      .request()
      .input("ItemID", sql.UniqueIdentifier, itemId)
      .input("IsPinned", sql.Bit, !!isPinned)
      .query(`UPDATE dbo.ClientWorkMarketIntelItems SET IsPinned = @IsPinned, UpdatedAt = SYSUTCDATETIME() WHERE MarketIntelItemID = @ItemID`);
    res.json({ ok: true, itemId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to pin item" });
  }
}

// -------------------------------
// Board Pack Builder (templates + packs) - MVP storage
// -------------------------------

export async function listBoardPackTemplates(req, res) {
  try {
    const pool = await poolPromise;
    const r = await pool.request().query(`SELECT TOP 100 BoardPackTemplateID, TemplateName, Description, UpdatedAt FROM dbo.ClientWorkBoardPackTemplates ORDER BY UpdatedAt DESC`);
    res.json({ templates: r.recordset || [] });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to list templates" });
  }
}

export async function upsertBoardPackTemplate(req, res) {
  try {
    const { templateId, templateName, description, templateJson } = req.body || {};
    const pool = await poolPromise;
    const isUpdate = templateId && isUuid(templateId);
    if (!templateName) return res.status(400).json({ error: "templateName is required" });

    if (!isUpdate) {
      const r = await pool
        .request()
        .input("TemplateName", sql.NVarChar(200), templateName)
        .input("Description", sql.NVarChar(sql.MAX), description || null)
        .input("TemplateJson", sql.NVarChar(sql.MAX), JSON.stringify(templateJson || {}))
        .input("CreatedByUserID", sql.UniqueIdentifier, req.user?.userId)
        .query(`
          DECLARE @id UNIQUEIDENTIFIER = NEWID();
          INSERT INTO dbo.ClientWorkBoardPackTemplates (BoardPackTemplateID, TemplateName, Description, TemplateJson, CreatedByUserID)
          VALUES (@id, @TemplateName, @Description, @TemplateJson, @CreatedByUserID);
          SELECT @id AS BoardPackTemplateID;
        `);
      return res.json({ ok: true, templateId: r.recordset?.[0]?.BoardPackTemplateID });
    }

    await pool
      .request()
      .input("TemplateID", sql.UniqueIdentifier, templateId)
      .input("TemplateName", sql.NVarChar(200), templateName)
      .input("Description", sql.NVarChar(sql.MAX), description || null)
      .input("TemplateJson", sql.NVarChar(sql.MAX), JSON.stringify(templateJson || {}))
      .query(`
        UPDATE dbo.ClientWorkBoardPackTemplates
        SET TemplateName = @TemplateName, Description = @Description, TemplateJson = @TemplateJson, UpdatedAt = SYSUTCDATETIME()
        WHERE BoardPackTemplateID = @TemplateID
      `);
    res.json({ ok: true, templateId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to upsert template" });
  }
}

export async function listBoardPacks(req, res) {
  try {
    const clientId = requireUuid("clientId", req.query.clientId);
    const pool = await poolPromise;
    const r = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .query(`
        SELECT TOP 50 BoardPackID, PeriodKey, Status, UpdatedAt, BoardPackTemplateID
        FROM dbo.ClientWorkBoardPacks
        WHERE ClientID = @ClientID
        ORDER BY UpdatedAt DESC
      `);
    res.json({ clientId, packs: r.recordset || [] });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to list board packs" });
  }
}

export async function upsertBoardPack(req, res) {
  try {
    const { boardPackId, clientId, periodKey, templateId, status, configJson } = req.body || {};
    requireUuid("clientId", clientId);
    if (!/^\d{4}-\d{2}$/.test(String(periodKey))) return res.status(400).json({ error: "periodKey must be YYYY-MM" });

    const pool = await poolPromise;
    const isUpdate = boardPackId && isUuid(boardPackId);
    if (!isUpdate) {
      const r = await pool
        .request()
        .input("ClientID", sql.UniqueIdentifier, clientId)
        .input("PeriodKey", sql.NVarChar(10), String(periodKey))
        .input("TemplateID", sql.UniqueIdentifier, templateId || null)
        .input("Status", sql.NVarChar(50), status || "Draft")
        .input("ConfigJson", sql.NVarChar(sql.MAX), JSON.stringify(configJson || {}))
        .input("CreatedByUserID", sql.UniqueIdentifier, req.user?.userId)
        .query(`
          DECLARE @id UNIQUEIDENTIFIER = NEWID();
          INSERT INTO dbo.ClientWorkBoardPacks (BoardPackID, ClientID, PeriodKey, BoardPackTemplateID, Status, ConfigJson, CreatedByUserID)
          VALUES (@id, @ClientID, @PeriodKey, @TemplateID, @Status, @ConfigJson, @CreatedByUserID);
          SELECT @id AS BoardPackID;
        `);
      return res.json({ ok: true, boardPackId: r.recordset?.[0]?.BoardPackID });
    }

    await pool
      .request()
      .input("BoardPackID", sql.UniqueIdentifier, boardPackId)
      .input("TemplateID", sql.UniqueIdentifier, templateId || null)
      .input("Status", sql.NVarChar(50), status || "Draft")
      .input("ConfigJson", sql.NVarChar(sql.MAX), JSON.stringify(configJson || {}))
      .query(`
        UPDATE dbo.ClientWorkBoardPacks
        SET BoardPackTemplateID = @TemplateID,
            Status = @Status,
            ConfigJson = @ConfigJson,
            UpdatedAt = SYSUTCDATETIME()
        WHERE BoardPackID = @BoardPackID
      `);
    res.json({ ok: true, boardPackId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to upsert board pack" });
  }
}

// -------------------------------
// Internal Accounting Staff + Evaluations
// -------------------------------

export async function listAccountingStaff(req, res) {
  try {
    const clientId = requireUuid("clientId", req.query.clientId);
    const pool = await poolPromise;
    const r = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .query(`
        SELECT AccountingStaffID, FullName, RoleTitle, Email, Phone, IsActive, CreatedAt, UpdatedAt
        FROM dbo.ClientWorkAccountingStaff
        WHERE ClientID = @ClientID
        ORDER BY IsActive DESC, FullName ASC
      `);
    res.json({ clientId, staff: r.recordset || [] });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to list staff" });
  }
}

export async function upsertAccountingStaff(req, res) {
  try {
    const { accountingStaffId, clientId, fullName, roleTitle, email, phone, isActive } = req.body || {};
    requireUuid("clientId", clientId);
    if (!fullName) return res.status(400).json({ error: "fullName is required" });

    const pool = await poolPromise;
    const isUpdate = accountingStaffId && isUuid(accountingStaffId);
    if (!isUpdate) {
      const r = await pool
        .request()
        .input("ClientID", sql.UniqueIdentifier, clientId)
        .input("FullName", sql.NVarChar(200), fullName)
        .input("RoleTitle", sql.NVarChar(200), roleTitle || null)
        .input("Email", sql.NVarChar(255), email || null)
        .input("Phone", sql.NVarChar(50), phone || null)
        .input("IsActive", sql.Bit, isActive !== false)
        .query(`
          DECLARE @id UNIQUEIDENTIFIER = NEWID();
          INSERT INTO dbo.ClientWorkAccountingStaff (AccountingStaffID, ClientID, FullName, RoleTitle, Email, Phone, IsActive)
          VALUES (@id, @ClientID, @FullName, @RoleTitle, @Email, @Phone, @IsActive);
          SELECT @id AS AccountingStaffID;
        `);
      return res.json({ ok: true, accountingStaffId: r.recordset?.[0]?.AccountingStaffID });
    }

    await pool
      .request()
      .input("StaffID", sql.UniqueIdentifier, accountingStaffId)
      .input("FullName", sql.NVarChar(200), fullName)
      .input("RoleTitle", sql.NVarChar(200), roleTitle || null)
      .input("Email", sql.NVarChar(255), email || null)
      .input("Phone", sql.NVarChar(50), phone || null)
      .input("IsActive", sql.Bit, isActive !== false)
      .query(`
        UPDATE dbo.ClientWorkAccountingStaff
        SET FullName = @FullName,
            RoleTitle = @RoleTitle,
            Email = @Email,
            Phone = @Phone,
            IsActive = @IsActive,
            UpdatedAt = SYSUTCDATETIME()
        WHERE AccountingStaffID = @StaffID
      `);
    res.json({ ok: true, accountingStaffId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to upsert staff" });
  }
}

export async function listStaffEvaluations(req, res) {
  try {
    const clientId = requireUuid("clientId", req.query.clientId);
    const pool = await poolPromise;
    const r = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .query(`
        SELECT TOP 50 EvaluationID, AccountingStaffID, PeriodKey, OverallRating, WouldHire, ShareableSummary, CreatedAt
        FROM dbo.ClientWorkAccountingStaffEvaluations
        WHERE ClientID = @ClientID
        ORDER BY CreatedAt DESC
      `);
    res.json({ clientId, evaluations: r.recordset || [] });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to list evaluations" });
  }
}

export async function createStaffEvaluation(req, res) {
  try {
    const { clientId, accountingStaffId, periodKey, overallRating, wouldHire, scoresJson, shareableSummary, internalNotes } = req.body || {};
    requireUuid("clientId", clientId);
    if (accountingStaffId && !isUuid(accountingStaffId)) return res.status(400).json({ error: "accountingStaffId must be UUID" });
    if (!/^\d{4}-\d{2}$/.test(String(periodKey))) return res.status(400).json({ error: "periodKey must be YYYY-MM" });

    const pool = await poolPromise;
    const r = await pool
      .request()
      .input("ClientID", sql.UniqueIdentifier, clientId)
      .input("AccountingStaffID", sql.UniqueIdentifier, accountingStaffId || null)
      .input("PeriodKey", sql.NVarChar(10), String(periodKey))
      .input("OverallRating", sql.Decimal(4, 2), overallRating != null ? Number(overallRating) : null)
      .input("WouldHire", sql.Bit, !!wouldHire)
      .input("ScoresJson", sql.NVarChar(sql.MAX), JSON.stringify(scoresJson || {}))
      .input("ShareableSummary", sql.NVarChar(sql.MAX), shareableSummary || null)
      .input("InternalNotes", sql.NVarChar(sql.MAX), internalNotes || null)
      .input("CreatedByUserID", sql.UniqueIdentifier, req.user?.userId)
      .query(`
        DECLARE @id UNIQUEIDENTIFIER = NEWID();
        INSERT INTO dbo.ClientWorkAccountingStaffEvaluations
          (EvaluationID, ClientID, AccountingStaffID, PeriodKey, OverallRating, WouldHire, ScoresJson, ShareableSummary, InternalNotes, CreatedByUserID)
        VALUES
          (@id, @ClientID, @AccountingStaffID, @PeriodKey, @OverallRating, @WouldHire, @ScoresJson, @ShareableSummary, @InternalNotes, @CreatedByUserID);
        SELECT @id AS EvaluationID;
      `);
    res.json({ ok: true, evaluationId: r.recordset?.[0]?.EvaluationID });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to create evaluation" });
  }
}
