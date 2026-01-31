import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Divider,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Chip,
} from "@mui/material";

import {
  listBoardPackTemplates,
  createBoardPackTemplate,
  updateBoardPackTemplate,
  deleteBoardPackTemplate,
  listBoardPacks,
  createBoardPack,
  getBoardPack,
  updateBoardPack,
} from "../../../api/clientWork";

import { listAiRuns, listCashForecast, listMarketIntelItems } from "../../../api/clientWork";

import logo from "../../../assets/logo.png";

function safeJson(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export default function BoardPackTab({ clientId, clientName }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateJson, setTemplateJson] = useState("{");

  const [packs, setPacks] = useState([]);
  const [selectedPackId, setSelectedPackId] = useState("");
  const [packPeriodKey, setPackPeriodKey] = useState("");
  const [packConfigJson, setPackConfigJson] = useState("{}");

  const [aiRuns, setAiRuns] = useState([]);
  const [forecasts, setForecasts] = useState(null);
  const [miItems, setMiItems] = useState([]);

  const printRef = useRef(null);

  const load = async () => {
    if (!clientId) return;
    setBusy(true);
    setError("");
    try {
      const [tplRes, packRes, aiRes, miRes] = await Promise.all([
        listBoardPackTemplates(),
        listBoardPacks(clientId),
        listAiRuns(clientId),
        listMarketIntelItems(clientId),
      ]);
      setTemplates(tplRes.data.templates || []);
      setPacks(packRes.data.packs || []);
      setAiRuns(aiRes.data.runs || []);
      setMiItems(miRes.data.items || []);

      // Cash forecast is optional; keep errors silent
      try {
        const cfRes = await listCashForecast(clientId, "Base");
        setForecasts(cfRes.data.forecast || null);
      } catch {
        setForecasts(null);
      }
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to load board pack builder data.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.TemplateID === selectedTemplateId),
    [templates, selectedTemplateId]
  );

  const selectedPack = useMemo(
    () => packs.find((p) => p.PackID === selectedPackId),
    [packs, selectedPackId]
  );

  useEffect(() => {
    if (selectedTemplate) {
      setTemplateJson(JSON.stringify(selectedTemplate.TemplateJson || {}, null, 2));
    }
  }, [selectedTemplate]);

  useEffect(() => {
    if (selectedPack) {
      setPackPeriodKey(selectedPack.PeriodKey || "");
      setSelectedTemplateId(selectedPack.TemplateID || "");
      setPackConfigJson(JSON.stringify(selectedPack.ConfigJson || {}, null, 2));
    }
  }, [selectedPack]);

  const onCreateTemplate = async () => {
    setBusy(true);
    setError("");
    try {
      const defaultTemplate = {
        name: "Board Pack Template",
        sections: [
          { key: "cover", title: "Cover" },
          { key: "executive_summary", title: "Executive Summary" },
          { key: "financial_highlights", title: "Financial Highlights" },
          { key: "cash_forecast", title: "13-Week Cash Forecast" },
          { key: "market_intel", title: "Market Intelligence" },
          { key: "governance", title: "Governance / Covenants" },
        ],
      };
      const res = await createBoardPackTemplate({
        name: `${clientName || "Client"} - Board Pack`,
        description: "Default board pack template",
        templateJson: defaultTemplate,
      });
      await load();
      setSelectedTemplateId(res.data.template?.TemplateID || "");
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to create template.");
    } finally {
      setBusy(false);
    }
  };

  const onSaveTemplate = async () => {
    if (!selectedTemplateId) return;
    setBusy(true);
    setError("");
    try {
      const next = safeJson(templateJson, {});
      await updateBoardPackTemplate(selectedTemplateId, {
        name: selectedTemplate?.Name,
        description: selectedTemplate?.Description,
        templateJson: next,
      });
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to save template.");
    } finally {
      setBusy(false);
    }
  };

  const onDeleteTemplate = async () => {
    if (!selectedTemplateId) return;
    if (!window.confirm("Delete this template?")) return;
    setBusy(true);
    setError("");
    try {
      await deleteBoardPackTemplate(selectedTemplateId);
      setSelectedTemplateId("");
      setTemplateJson("{}");
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to delete template.");
    } finally {
      setBusy(false);
    }
  };

  const onCreatePack = async () => {
    if (!clientId) return;
    setBusy(true);
    setError("");
    try {
      const period = packPeriodKey || new Date().toISOString().slice(0, 7);
      const cfg = safeJson(packConfigJson, {});
      const res = await createBoardPack({
        clientId,
        templateId: selectedTemplateId || null,
        periodKey: period,
        title: `${clientName || "Client"} Board Pack`,
        configJson: cfg,
      });
      await load();
      setSelectedPackId(res.data.pack?.PackID || "");
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to create board pack.");
    } finally {
      setBusy(false);
    }
  };

  const onSavePack = async () => {
    if (!selectedPackId) return;
    setBusy(true);
    setError("");
    try {
      const cfg = safeJson(packConfigJson, {});
      await updateBoardPack(selectedPackId, {
        periodKey: packPeriodKey,
        templateId: selectedTemplateId || null,
        configJson: cfg,
      });
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to save board pack.");
    } finally {
      setBusy(false);
    }
  };

  const onPrint = () => {
    const el = printRef.current;
    if (!el) return;

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    const html = `
      <html>
        <head>
          <title>Board Pack</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
            .page { padding: 40px 48px; }
            .cover { height: 95vh; display: flex; flex-direction: column; justify-content: space-between; }
            .brand-row { display: flex; align-items: center; justify-content: space-between; }
            .brand-row img { height: 44px; }
            .client-logo { height: 44px; width: 160px; border: 1px dashed #999; display: flex; align-items: center; justify-content: center; color: #666; font-size: 12px; }
            h1 { margin: 0; font-size: 28px; }
            h2 { margin: 18px 0 8px; font-size: 18px; }
            .muted { color: #666; font-size: 12px; }
            .section { margin-top: 16px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .kpi { border: 1px solid #ddd; padding: 10px; border-radius: 6px; }
            .kpi .label { font-size: 12px; color: #666; }
            .kpi .value { font-size: 18px; font-weight: bold; }
            .table { width: 100%; border-collapse: collapse; }
            .table th, .table td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
            .table th { background: #f5f5f5; text-align: left; }
            @media print { .page { page-break-after: always; } }
          </style>
        </head>
        <body>${el.innerHTML}</body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const latestAiRun = aiRuns?.[0] || null;
  const pinnedNews = miItems.filter((i) => i.IsPinned).slice(0, 8);

  // Build a preview data object from multiple sources.
  const preview = useMemo(() => {
    const cfg = safeJson(packConfigJson, {});
    return {
      periodKey: packPeriodKey || selectedPack?.PeriodKey || new Date().toISOString().slice(0, 7),
      aiRunId: cfg.aiRunId || latestAiRun?.RunID || null,
      includeCash: cfg.includeCash !== false,
      includeMarketIntel: cfg.includeMarketIntel !== false,
      includeCovenants: cfg.includeCovenants !== false,
      includeCloseQa: cfg.includeCloseQa !== false,
      headline: cfg.headline || "",
    };
  }, [packConfigJson, packPeriodKey, latestAiRun, selectedPack]);

  const coverTitle = `${clientName || "Client"} Board Pack`;
  const coverSubtitle = `Period: ${preview.periodKey}`;

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <Typography variant="h6">Board Pack Builder</Typography>
          <Chip label="PDF via Print" size="small" />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            V1 is a configuration + print-ready preview. The export format is PDF (client-facing). PPTX can be added later.
          </Typography>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle1">Templates</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
            <TextField
              select
              label="Template"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              sx={{ minWidth: 280 }}
              size="small"
            >
              {templates.map((t) => (
                <MenuItem key={t.TemplateID} value={t.TemplateID}>
                  {t.Name}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" onClick={onCreateTemplate} disabled={busy}>
              New Template
            </Button>
            <Button variant="contained" onClick={onSaveTemplate} disabled={busy || !selectedTemplateId}>
              Save Template JSON
            </Button>
            <Button color="error" onClick={onDeleteTemplate} disabled={busy || !selectedTemplateId}>
              Delete
            </Button>
            {busy && <CircularProgress size={20} />}
          </Stack>
          <TextField
            label="Template JSON"
            multiline
            minRows={8}
            value={templateJson}
            onChange={(e) => setTemplateJson(e.target.value)}
            helperText="TemplateJson is used by the pack to decide which sections to include."
          />
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle1">Packs</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
            <TextField
              select
              label="Existing Pack"
              value={selectedPackId}
              onChange={(e) => setSelectedPackId(e.target.value)}
              sx={{ minWidth: 280 }}
              size="small"
            >
              <MenuItem value="">(none)</MenuItem>
              {packs.map((p) => (
                <MenuItem key={p.PackID} value={p.PackID}>
                  {p.Title} — {p.PeriodKey}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Period (YYYY-MM)"
              value={packPeriodKey}
              onChange={(e) => setPackPeriodKey(e.target.value)}
              size="small"
              sx={{ width: 160 }}
            />
            <Button variant="outlined" onClick={onCreatePack} disabled={busy || !clientId}>
              Create Pack
            </Button>
            <Button variant="contained" onClick={onSavePack} disabled={busy || !selectedPackId}>
              Save Pack Config
            </Button>
            <Button variant="contained" color="secondary" onClick={onPrint}>
              Print / Save PDF
            </Button>
          </Stack>
          <TextField
            label="Pack Config JSON"
            multiline
            minRows={6}
            value={packConfigJson}
            onChange={(e) => setPackConfigJson(e.target.value)}
            helperText={
              "ConfigJson can reference aiRunId, includeCash, includeMarketIntel, includeCovenants, includeCloseQa, headline."
            }
          />
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle1">Preview</Typography>
          <Divider />

          <Box ref={printRef}>
            {/* Cover */}
            <div className="page cover">
              <div className="brand-row">
                <img src={logo} alt="CFO Worx" />
                <div className="client-logo">Client logo</div>
              </div>
              <div>
                <h1>{coverTitle}</h1>
                <div className="muted">{coverSubtitle}</div>
                {preview.headline && <div className="muted">{preview.headline}</div>}
              </div>
              <div className="muted">Prepared by CFO Worx</div>
            </div>

            {/* Executive summary */}
            <div className="page">
              <h2>Executive Summary</h2>
              <div className="muted">
                This pack is intended as an executive-level snapshot of performance, cash outlook, and market context.
              </div>
              <div className="section">
                <div className="kpi-grid">
                  <div className="kpi">
                    <div className="label">AI Report</div>
                    <div className="value">{latestAiRun ? latestAiRun.Status : "Not run"}</div>
                  </div>
                  <div className="kpi">
                    <div className="label">Cash Forecast</div>
                    <div className="value">{forecasts ? "Available" : "Not set"}</div>
                  </div>
                  <div className="kpi">
                    <div className="label">Pinned Intel</div>
                    <div className="value">{pinnedNews.length}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cash forecast */}
            {preview.includeCash && forecasts && (
              <div className="page">
                <h2>13-Week Cash Forecast (Base)</h2>
                <div className="muted">Week-ending Fridays; two-scenario comparison can be enabled later.</div>
                <div className="section">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Week Ending</th>
                        <th>Opening</th>
                        <th>Inflows</th>
                        <th>Outflows</th>
                        <th>Ending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(forecasts.weeks || []).slice(0, 13).map((w) => (
                        <tr key={w.weekEndingDate}>
                          <td>{w.weekEndingDate}</td>
                          <td>{w.openingCash?.toLocaleString?.() ?? w.openingCash}</td>
                          <td>{w.inflows?.toLocaleString?.() ?? w.inflows}</td>
                          <td>{w.outflows?.toLocaleString?.() ?? w.outflows}</td>
                          <td>{w.endingCash?.toLocaleString?.() ?? w.endingCash}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Market intel */}
            {preview.includeMarketIntel && (
              <div className="page">
                <h2>Market Intelligence</h2>
                <div className="muted">A curated set of recent updates relevant to the business and its ecosystem.</div>
                <div className="section">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Source</th>
                        <th>Published</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pinnedNews.length ? pinnedNews : miItems.slice(0, 8)).map((i) => (
                        <tr key={i.ItemID}>
                          <td>{i.Title}</td>
                          <td>{i.SourceName}</td>
                          <td>{i.PublishedAt?.slice?.(0, 10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* AI report placeholder */}
            <div className="page">
              <h2>Financial Commentary (Draft)</h2>
              <div className="muted">
                Pulls from the AI reporting engine draft. This slide is a placeholder in V1; wire it to a selected AI run
                by setting <code>aiRunId</code> in the pack config.
              </div>
              <div className="section">
                <div className="muted">AI run: {preview.aiRunId || "(none)"}</div>
              </div>
            </div>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}
