import ROIWin from '../models/ROIWin.js';

/**
 * ROI Tracker controller
 *
 * Relies on req.user from authenticateJWT.
 */

function getUserContext(req) {
  const user = req.user || {};
  const rolesArray = Array.isArray(user.roles) ? user.roles : [];
  return {
    userId: user.userId || user.UserID || null,
    role: user.role || user.Role || rolesArray[0] || null,
    consultantId: user.consultantId || user.ConsultantID || null,
    clientId: user.clientId || user.ClientID || null,
  };
}

function safeInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function safeDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeConsultants(payload) {
  const raw = (payload && (payload.consultants || payload.winConsultants || payload.consultantSplits)) || [];
  return (raw || [])
    .map((c, idx) => {
      const consultantId = c.ConsultantID || c.consultantId || c.ConsultantId;
      const pct = c.PercentSplit ?? c.percentSplit;
      const percentSplit = pct === undefined || pct === null ? null : Number(pct);
      return {
        ConsultantID: consultantId,
        PercentSplit: Number.isFinite(percentSplit) ? percentSplit : null,
        IsPrimary: (c.IsPrimary ?? c.isPrimary) ?? idx === 0,
      };
    })
    .filter((c) => c.ConsultantID);
}

function monthKey(dateObj) {
  const y = dateObj.getUTCFullYear();
  const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthStartUTC(year, monthIndex0) {
  return new Date(Date.UTC(year, monthIndex0, 1));
}

function endOfMonthUTC(dateObj) {
  return new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth() + 1, 0));
}

function daysInMonthUTC(dateObj) {
  const end = endOfMonthUTC(dateObj);
  return end.getUTCDate();
}

function clampDate(d, minD, maxD) {
  if (!d) return null;
  if (d < minD) return minD;
  if (d > maxD) return maxD;
  return d;
}

function dateOnlyUTC(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addMonthsUTC(dateObj, months) {
  return new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth() + months, dateObj.getUTCDate()));
}

function listMonthsUTC(startDate, endDate) {
  const s = monthStartUTC(startDate.getUTCFullYear(), startDate.getUTCMonth());
  const e = monthStartUTC(endDate.getUTCFullYear(), endDate.getUTCMonth());

  const months = [];
  let cur = s;
  while (cur <= e) {
    months.push(cur);
    cur = monthStartUTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1);
  }
  return months;
}

function daysBetweenInclusiveUTC(startDate, endDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const s = dateOnlyUTC(startDate);
  const e = dateOnlyUTC(endDate);
  return Math.floor((e - s) / msPerDay) + 1;
}

/**
 * Compute monthly allocations for a single win within the given range.
 *
 * Returns array of { month: 'YYYY-MM', recurring: number, oneTime: number, total: number }
 */
function computeMonthlyAllocations(win, rangeStart, rangeEnd) {
  const out = [];
  const months = listMonthsUTC(rangeStart, rangeEnd);

  for (const monthStart of months) {
    const monthEnd = endOfMonthUTC(monthStart);
    const monthStartClamped = clampDate(monthStart, rangeStart, rangeEnd);
    const monthEndClamped = clampDate(monthEnd, rangeStart, rangeEnd);

    if (!monthStartClamped || !monthEndClamped || monthStartClamped > monthEndClamped) continue;

    let recurring = 0;
    let oneTime = 0;

    if (win.ImpactType === 'Recurring') {
      const s = safeDate(win.RecurringStartDate);
      const e = safeDate(win.RecurringEndDate) || null;

      if (s) {
        const activeStart = clampDate(s, monthStart, monthEnd);
        const activeEnd = clampDate(e || monthEnd, monthStart, monthEnd);

        if (activeStart && activeEnd && activeStart <= activeEnd) {
          const dim = daysInMonthUTC(monthStart);
          const activeDays = daysBetweenInclusiveUTC(activeStart, activeEnd);
          const monthly = Number(win.RecurringMonthlyAmount || 0);
          recurring = (monthly * activeDays) / dim;
        }
      }
    }

    if (win.ImpactType === 'OneTime') {
      const impact = safeDate(win.ImpactDate);
      const total = Number(win.OneTimeTotalValue || 0);
      const spreadMonths = Math.max(1, Math.min(3, safeInt(win.OneTimeSpreadMonths) || 1));

      if (impact && total > 0) {
        const impactMonthStart = monthStartUTC(impact.getUTCFullYear(), impact.getUTCMonth());
        const spreadEnd = endOfMonthUTC(addMonthsUTC(impactMonthStart, spreadMonths - 1));
        const rangeWinStart = impact;
        const rangeWinEnd = spreadEnd;

        // If the month overlaps the [impact .. spreadEnd] window, allocate by days-in-month.
        const overlapStart = clampDate(rangeWinStart, monthStart, monthEnd);
        const overlapEnd = clampDate(rangeWinEnd, monthStart, monthEnd);

        if (overlapStart && overlapEnd && overlapStart <= overlapEnd) {
          const totalDays = daysBetweenInclusiveUTC(rangeWinStart, rangeWinEnd);
          const overlapDays = daysBetweenInclusiveUTC(overlapStart, overlapEnd);
          oneTime = (total * overlapDays) / totalDays;
        }
      }
    }

    const total = recurring + oneTime;
    if (total !== 0) {
      out.push({
        month: monthKey(monthStart),
        recurring,
        oneTime,
        total,
      });
    }
  }

  return out;
}

function sumAllocationsForRange(win, rangeStart, rangeEnd) {
  const allocs = computeMonthlyAllocations(win, rangeStart, rangeEnd);
  return allocs.reduce(
    (acc, a) => {
      acc.recurring += a.recurring;
      acc.oneTime += a.oneTime;
      acc.total += a.total;
      return acc;
    },
    { recurring: 0, oneTime: 0, total: 0 }
  );
}

const ROIController = {
  async getSettings(req, res) {
    try {
      const settings = await ROIWin.getSettings();
      res.json(settings);
    } catch (err) {
      console.error('ROI getSettings error:', err);
      res.status(500).json({ error: 'Failed to load ROI settings.' });
    }
  },

  async upsertActivityTag(req, res) {
    try {
      const { activityTagID, name, isActive } = req.body;
      if (!name || String(name).trim().length < 2) {
        return res.status(400).json({ error: 'Tag name is required.' });
      }

      const tag = await ROIWin.upsertActivityTag({
        activityTagID: activityTagID ? Number(activityTagID) : null,
        name: String(name).trim(),
        isActive: isActive !== false,
      });

      res.json(tag);
    } catch (err) {
      console.error('ROI upsertActivityTag error:', err);
      res.status(500).json({ error: 'Failed to save activity tag.' });
    }
  },

  async upsertRejectionReason(req, res) {
    try {
      const { rejectionReasonID, reasonText, isActive, sortOrder } = req.body;
      if (!reasonText || String(reasonText).trim().length < 3) {
        return res.status(400).json({ error: 'Reason text is required.' });
      }

      const reason = await ROIWin.upsertRejectionReason({
        rejectionReasonID: rejectionReasonID ? Number(rejectionReasonID) : null,
        reasonText: String(reasonText).trim(),
        isActive: isActive !== false,
        sortOrder: sortOrder != null ? Number(sortOrder) : 50,
      });

      res.json(reason);
    } catch (err) {
      console.error('ROI upsertRejectionReason error:', err);
      res.status(500).json({ error: 'Failed to save rejection reason.' });
    }
  },

  async listWins(req, res) {
    try {
      const ctx = getUserContext(req);
      const wins = await ROIWin.listWins({
        clientId: req.query.clientId || null,
        status: req.query.status || null,
        from: req.query.from || null,
        to: req.query.to || null,
        includeDeleted: req.query.includeDeleted === 'true',
        userContext: ctx,
      });
      res.json(wins);
    } catch (err) {
      console.error('ROI listWins error:', err);
      res.status(500).json({ error: 'Failed to load ROI wins.' });
    }
  },

  async getWin(req, res) {
    try {
      const win = await ROIWin.getWin(req.params.id);
      if (!win) return res.status(404).json({ error: 'Win not found.' });
      res.json(win);
    } catch (err) {
      console.error('ROI getWin error:', err);
      res.status(500).json({ error: 'Failed to load ROI win.' });
    }
  },

  async createWin(req, res) {
    try {
      const ctx = getUserContext(req);
      const payload = req.body || {};
      const win = payload.win || payload;

      // Validate required fields
      if (!win.clientId) {
        return res.status(400).json({ error: 'Client ID is required.' });
      }
      if (!win.title || String(win.title).trim().length < 1) {
        return res.status(400).json({ error: 'Title is required.' });
      }
      if (!win.categoryId) {
        return res.status(400).json({ error: 'Category ID is required.' });
      }
      if (!win.impactDate) {
        return res.status(400).json({ error: 'Impact date is required.' });
      }
      if (!win.impactType || !['Recurring', 'OneTime'].includes(win.impactType)) {
        return res.status(400).json({ error: 'Impact type must be Recurring or OneTime.' });
      }

      // Validate impactDate format
      const impactDate = safeDate(win.impactDate);
      if (!impactDate) {
        return res.status(400).json({ error: 'Invalid impact date format.' });
      }

      const created = await ROIWin.createWin({
        clientId: win.clientId,
        title: String(win.title).trim(),
        categoryId: Number(win.categoryId),
        impactType: win.impactType,
        impactDate: impactDate,
        recurringMonthlyAmount: win.recurringMonthlyAmount != null ? Number(win.recurringMonthlyAmount) : null,
        recurringStartDate: win.recurringStartDate ? safeDate(win.recurringStartDate) : null,
        recurringEndDate: win.recurringEndDate ? safeDate(win.recurringEndDate) : null,
        oneTimeTotalValue: win.oneTimeTotalValue != null ? Number(win.oneTimeTotalValue) : null,
        oneTimeSpreadMonths: win.oneTimeSpreadMonths != null ? safeInt(win.oneTimeSpreadMonths) : 1,
        internalNotes: win.internalNotes || null,
        externalNotes: win.externalNotes || null,
        clientOwnerUserId: win.clientOwnerUserId || null,
        activityTagIds: (win.activityTags || win.activityTagIds || []).map(id => Number(id)),
        consultants: normalizeConsultants(payload),
        createdByUserId: ctx.userId,
      });

      res.status(201).json({ roiWinId: created });
    } catch (err) {
      console.error('ROI createWin error:', err);
      res.status(400).json({ error: err.message || 'Failed to create ROI win.' });
    }
  },

  async updateWin(req, res) {
    try {
      const ctx = getUserContext(req);
      const payload = req.body || {};
      const win = payload.win || payload;

      // Validate required fields
      if (!win.title || String(win.title).trim().length < 1) {
        return res.status(400).json({ error: 'Title is required.' });
      }
      if (!win.categoryId) {
        return res.status(400).json({ error: 'Category ID is required.' });
      }
      if (!win.impactDate) {
        return res.status(400).json({ error: 'Impact date is required.' });
      }
      if (!win.impactType || !['Recurring', 'OneTime'].includes(win.impactType)) {
        return res.status(400).json({ error: 'Impact type must be Recurring or OneTime.' });
      }

      // Validate impactDate format
      const impactDate = safeDate(win.impactDate);
      if (!impactDate) {
        return res.status(400).json({ error: 'Invalid impact date format.' });
      }

      const updated = await ROIWin.updateWin(req.params.id, {
        title: String(win.title).trim(),
        categoryId: Number(win.categoryId),
        impactType: win.impactType,
        impactDate: impactDate,
        recurringMonthlyAmount: win.recurringMonthlyAmount != null ? Number(win.recurringMonthlyAmount) : null,
        recurringStartDate: win.recurringStartDate ? safeDate(win.recurringStartDate) : null,
        recurringEndDate: win.recurringEndDate ? safeDate(win.recurringEndDate) : null,
        oneTimeTotalValue: win.oneTimeTotalValue != null ? Number(win.oneTimeTotalValue) : null,
        oneTimeSpreadMonths: win.oneTimeSpreadMonths != null ? safeInt(win.oneTimeSpreadMonths) : 1,
        internalNotes: win.internalNotes || null,
        externalNotes: win.externalNotes || null,
        clientOwnerUserId: win.clientOwnerUserId || null,
        activityTagIds: Array.isArray(win.activityTags) || Array.isArray(win.activityTagIds) 
          ? (win.activityTags || win.activityTagIds || []).map(id => Number(id))
          : undefined,
        consultants: Array.isArray(payload.consultants) || Array.isArray(payload.consultantSplits)
          ? normalizeConsultants(payload)
          : undefined,
        correctionNote: win.correctionNote || null,
        editedByUserId: ctx.userId,
        resetToDraft: win.resetToDraft === true,
      });

      res.json(updated);
    } catch (err) {
      console.error('ROI updateWin error:', err);
      res.status(400).json({ error: err.message || 'Failed to update ROI win.' });
    }
  },

  async deleteWin(req, res) {
    try {
      const ctx = getUserContext(req);
      const deleted = await ROIWin.softDeleteWin({
        roiWinId: req.params.id,
        deletedByUserId: ctx.userId,
      });
      res.json(deleted);
    } catch (err) {
      console.error('ROI deleteWin error:', err);
      res.status(400).json({ error: err.message || 'Failed to delete ROI win.' });
    }
  },

  async submitWin(req, res) {
    try {
      const ctx = getUserContext(req);
      const result = await ROIWin.setStatusSubmitted({
        roiWinId: req.params.id,
        submittedByUserId: ctx.userId,
      });
      res.json(result);
    } catch (err) {
      console.error('ROI submitWin error:', err);
      res.status(400).json({ error: err.message || 'Failed to submit ROI win.' });
    }
  },

  async approveWin(req, res) {
    try {
      const ctx = getUserContext(req);
      const result = await ROIWin.setStatusApproved({
        roiWinId: req.params.id,
        approvedByUserId: ctx.userId,
      });
      res.json(result);
    } catch (err) {
      console.error('ROI approveWin error:', err);
      res.status(400).json({ error: err.message || 'Failed to approve ROI win.' });
    }
  },

  async rejectWin(req, res) {
    try {
      const ctx = getUserContext(req);
      const { rejectionReasonID, rejectionNote } = req.body || {};
      const result = await ROIWin.setStatusRejected({
        roiWinId: req.params.id,
        rejectedByUserId: ctx.userId,
        rejectionReasonId: rejectionReasonID ? Number(rejectionReasonID) : null,
        rejectionNote: rejectionNote ? String(rejectionNote) : null,
      });
      res.json(result);
    } catch (err) {
      console.error('ROI rejectWin error:', err);
      res.status(400).json({ error: err.message || 'Failed to reject ROI win.' });
    }
  },

  async dashboard(req, res) {
    try {
      const ctx = getUserContext(req);

      // Reference month (YYYY-MM). Defaults to current UTC month.
      const now = new Date();
      const monthStr = req.query.month || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const [yStr, mStr] = String(monthStr).split('-');
      const year = Number(yStr);
      const monthIndex0 = Number(mStr) - 1;
      if (!Number.isFinite(year) || !Number.isFinite(monthIndex0) || monthIndex0 < 0 || monthIndex0 > 11) {
        return res.status(400).json({ error: 'Invalid month. Use YYYY-MM.' });
      }

      const refMonthStart = monthStartUTC(year, monthIndex0);
      const refMonthEnd = endOfMonthUTC(refMonthStart);

      const ytdStart = monthStartUTC(year, 0);
      const ytdEnd = refMonthEnd;

      // Series (last 12 months ending reference month)
      const seriesStart = monthStartUTC(refMonthStart.getUTCFullYear(), refMonthStart.getUTCMonth() - 11);
      const seriesEnd = refMonthEnd;

      const clientId = req.query.clientId || null;
      const consultantId = req.query.consultantId || null;

      const wins = await ROIWin.listApprovedWinsForDashboard({
        rangeStart: seriesStart,
        rangeEnd: seriesEnd,
        clientId,
        consultantId,
        userContext: ctx,
      });

      // Build series buckets
      const months = listMonthsUTC(seriesStart, seriesEnd);
      const seriesMap = new Map(months.map((m) => [monthKey(m), { month: monthKey(m), recurring: 0, oneTime: 0, total: 0 }]));

      // Aggregates
      const byCategory = new Map();
      const byConsultant = new Map();
      const byClient = new Map();

      for (const win of wins) {
        // Monthly allocation for win
        const allocs = computeMonthlyAllocations(win, seriesStart, seriesEnd);

        // Apply consultant splits if requested byConsultant
        const consultants = Array.isArray(win.consultants) ? win.consultants : [];

        for (const a of allocs) {
          const bucket = seriesMap.get(a.month);
          if (bucket) {
            bucket.recurring += a.recurring;
            bucket.oneTime += a.oneTime;
            bucket.total += a.total;
          }

          // Client totals
          if (win.ClientID) {
            const cKey = win.ClientID;
            if (!byClient.has(cKey)) {
              byClient.set(cKey, { clientId: win.ClientID, clientName: win.ClientName, total: 0, recurring: 0, oneTime: 0 });
            }
            const c = byClient.get(cKey);
            c.total += a.total;
            c.recurring += a.recurring;
            c.oneTime += a.oneTime;
          }

          // Category totals
          const catName = win.CategoryName || 'Uncategorized';
          if (!byCategory.has(catName)) byCategory.set(catName, { category: catName, total: 0, recurring: 0, oneTime: 0 });
          const cat = byCategory.get(catName);
          cat.total += a.total;
          cat.recurring += a.recurring;
          cat.oneTime += a.oneTime;

          // Consultant totals
          if (consultants.length > 0) {
            for (const wc of consultants) {
              const pct = Number(wc.PercentSplit || 0) / 100;
              if (!wc.ConsultantID || pct <= 0) continue;

              if (!byConsultant.has(wc.ConsultantID)) {
                byConsultant.set(wc.ConsultantID, {
                  consultantId: wc.ConsultantID,
                  consultantName: wc.ConsultantName,
                  total: 0,
                  recurring: 0,
                  oneTime: 0,
                });
              }
              const cons = byConsultant.get(wc.ConsultantID);
              cons.total += a.total * pct;
              cons.recurring += a.recurring * pct;
              cons.oneTime += a.oneTime * pct;
            }
          }
        }
      }

      // Month totals
      const monthTotals = wins.reduce(
        (acc, w) => {
          const m = sumAllocationsForRange(w, refMonthStart, refMonthEnd);
          acc.total += m.total;
          acc.recurring += m.recurring;
          acc.oneTime += m.oneTime;
          return acc;
        },
        { total: 0, recurring: 0, oneTime: 0 }
      );

      // YTD totals
      const ytdTotals = wins.reduce(
        (acc, w) => {
          const m = sumAllocationsForRange(w, ytdStart, ytdEnd);
          acc.total += m.total;
          acc.recurring += m.recurring;
          acc.oneTime += m.oneTime;
          return acc;
        },
        { total: 0, recurring: 0, oneTime: 0 }
      );

      // Top clients (top 3 by total over series range)
      const topClients = Array.from(byClient.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 3);

      // ROI multiple (only if clientId provided)
      let roiMultiple = null;
      if (clientId) {
        const mrr = await ROIWin.getMonthlyMRRForClient({
          clientId,
          monthStart: refMonthStart,
        });

        const annualSpend = (Number(mrr || 0) * 12);
        const annualizedRecurring = (monthTotals.recurring * 12);
        const annualizedTotal = (monthTotals.recurring * 12) + monthTotals.oneTime; // one-time treated as already annual impact
        const multiple = annualSpend > 0 ? annualizedTotal / annualSpend : null;

        roiMultiple = {
          monthMRR: mrr,
          annualSpend,
          annualizedRecurring,
          annualizedTotal,
          multiple,
        };
      }

      res.json({
        month: monthKey(refMonthStart),
        totals: {
          month: monthTotals,
          ytd: ytdTotals,
        },
        series: Array.from(seriesMap.values()),
        byCategory: Array.from(byCategory.values()).sort((a, b) => b.total - a.total),
        byConsultant: Array.from(byConsultant.values()).sort((a, b) => b.total - a.total),
        topClients,
        roiMultiple,
      });
    } catch (err) {
      console.error('ROI dashboard error:', err);
      res.status(500).json({ error: 'Failed to load ROI dashboard.' });
    }
  },
};

export default ROIController;
