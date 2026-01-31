import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Divider,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  FormControlLabel,
  Switch,
} from "@mui/material";

import {
  listMarketIntelItems,
  refreshMarketIntel,
  pinMarketIntelItem,
  getClientWorkSettings,
  updateClientWorkSettings,
} from "../../../api/clientWork";

function safeParse(json, fallback) {
  try {
    return json ? JSON.parse(json) : fallback;
  } catch {
    return fallback;
  }
}

export default function MarketIntelTab({ clientId, clientName }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Simple settings: keywords / competitors / geography.
  const [settings, setSettings] = useState({
    keywords: "",
    geography: "",
    competitors: "",
    includeMA: true,
    includeValuation: true,
  });

  const settingsJson = useMemo(() => {
    const out = {
      ...(settings || {}),
      competitors: (settings.competitors || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      keywords: (settings.keywords || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    return JSON.stringify({ marketIntel: out }, null, 2);
  }, [settings]);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    setError("");
    try {
      const [itemsRes, settingsRes] = await Promise.all([
        listMarketIntelItems(clientId),
        getClientWorkSettings(clientId),
      ]);

      setItems(itemsRes.data.items || []);

      const parsed = safeParse(settingsRes.data.settingsJson, {});
      const mi = parsed.marketIntel || {};
      setSettings({
        keywords: Array.isArray(mi.keywords) ? mi.keywords.join("\n") : "",
        geography: mi.geography || "",
        competitors: Array.isArray(mi.competitors) ? mi.competitors.join("\n") : "",
        includeMA: mi.includeMA !== false,
        includeValuation: mi.includeValuation !== false,
      });
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to load market intelligence.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleRefresh = async () => {
    if (!clientId) return;
    setRefreshing(true);
    setError("");
    try {
      await updateClientWorkSettings(clientId, settingsJson);
      await refreshMarketIntel(clientId);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  };

  const handlePin = async (itemId, isPinned) => {
    try {
      await pinMarketIntelItem(itemId, !isPinned);
      setItems((prev) => prev.map((i) => (i.ItemID === itemId ? { ...i, IsPinned: !isPinned } : i)));
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to update pin.");
    }
  };

  const pinnedCount = useMemo(() => items.filter((i) => i.IsPinned).length, [items]);

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="h6">Market Intelligence</Typography>
          <Typography variant="body2" color="text.secondary">
            Curated news + updates for <b>{clientName}</b>. Uses a configurable keyword set and can be refreshed on demand.
          </Typography>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stack spacing={2} direction={{ xs: "column", md: "row" }}>
          <TextField
            label="Primary Keywords (one per line)"
            value={settings.keywords}
            onChange={(e) => setSettings((s) => ({ ...s, keywords: e.target.value }))}
            multiline
            minRows={4}
            fullWidth
          />
          <Stack spacing={2} sx={{ minWidth: { md: 360 } }}>
            <TextField
              label="Geography"
              value={settings.geography}
              onChange={(e) => setSettings((s) => ({ ...s, geography: e.target.value }))}
              placeholder="e.g., Austin, TX / Texas / USA"
            />
            <TextField
              label="Competitors (one per line)"
              value={settings.competitors}
              onChange={(e) => setSettings((s) => ({ ...s, competitors: e.target.value }))}
              multiline
              minRows={4}
            />
            <Stack direction="row" spacing={2}>
              <FormControlLabel
                control={<Switch checked={settings.includeMA} onChange={(e) => setSettings((s) => ({ ...s, includeMA: e.target.checked }))} />}
                label="Include M&A"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.includeValuation}
                    onChange={(e) => setSettings((s) => ({ ...s, includeValuation: e.target.checked }))}
                  />
                }
                label="Include Valuation"
              />
            </Stack>

            <Stack direction="row" spacing={2} alignItems="center">
              <Button variant="contained" onClick={handleRefresh} disabled={refreshing || loading}>
                {refreshing ? "Refreshing…" : "Refresh Feed"}
              </Button>
              <Chip label={`${pinnedCount} pinned`} variant="outlined" />
              {(loading || refreshing) && <CircularProgress size={18} />}
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Feed
        </Typography>
        {loading ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Loading items…
            </Typography>
          </Stack>
        ) : items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No items yet. Click “Refresh Feed”.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Published</TableCell>
                  <TableCell>Pin</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.slice(0, 80).map((i) => (
                  <TableRow key={i.ItemID} hover>
                    <TableCell>
                      <a href={i.Url} target="_blank" rel="noreferrer">
                        {i.Title}
                      </a>
                      {i.Summary && (
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                          {i.Summary}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{i.SourceName || "—"}</TableCell>
                    <TableCell>{i.PublishedAt ? String(i.PublishedAt).slice(0, 10) : "—"}</TableCell>
                    <TableCell>
                      <Button size="small" variant={i.IsPinned ? "contained" : "outlined"} onClick={() => handlePin(i.ItemID, i.IsPinned)}>
                        {i.IsPinned ? "Pinned" : "Pin"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Stack>
  );
}
