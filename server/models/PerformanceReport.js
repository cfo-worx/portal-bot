import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js';
import { poolPromise, sql } from '../db.js';
import GlobalSetting from './GlobalSetting.js';
import HolidayCalendar from './HolidayCalendar.js';
import ReportIssueNote from './ReportIssueNote.js';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const UNASSIGNED = '__unassigned__';

function normalizeRole(role) {
  return (role ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function toDateStr(d) {
  return dayjs(d).format('YYYY-MM-DD');
}

function parseDateInput(value) {
  if (value == null) return null;
  const d = dayjs(value);
  if (!d.isValid()) return null;
  return d.startOf('day');
}

function enumerateDays(start, end) {
  const days = [];
  let cursor = start.startOf('day');
  const last = end.startOf('day');
  while (cursor.isSameOrBefore(last, 'day')) {
    days.push(cursor);
    cursor = cursor.add(1, 'day');
  }
  return days;
}

function isWeekend(d) {
  const dow = d.day(); // 0 Sun, 6 Sat
  return dow === 0 || dow === 6;
}

function buildHolidaySet(holidays) {
  const set = new Set();
  for (const h of holidays ?? []) {
    if (h?.HolidayDate) set.add(toDateStr(h.HolidayDate));
  }
  return set;
}

function isWorkingDay(d, businessDaysOnly, holidaySet) {
  if (!businessDaysOnly) return true;
  if (isWeekend(d)) return false;
  const ds = toDateStr(d);
  if (holidaySet.has(ds)) return false;
  return true;
}

function getMonthKey(d) {
  return dayjs(d).format('YYYY-MM');
}

function getMonthDays(d, businessDaysOnly, holidaySet) {
  const monthStart = dayjs(d).startOf('month');
  const monthEnd = dayjs(d).endOf('month');
  return enumerateDays(monthStart, monthEnd).filter(x => isWorkingDay(x, businessDaysOnly, holidaySet));
}

function getDistributionWeights(monthDays, distributionType) {
  const type = normalizeRole(distributionType || 'linear');
  const n = monthDays.length;
  if (n === 0) return {};
  let raw = new Array(n).fill(1);

  if (type === 'front_loaded' || type === 'front-loaded' || type === 'front loaded') {
    raw = raw.map((_, i) => 1.5 - (i * (1.0 / Math.max(1, n - 1)))); // 1.5 -> 0.5
  } else if (type === 'back_loaded' || type === 'back-loaded' || type === 'back loaded') {
    raw = raw.map((_, i) => 0.5 + (i * (1.0 / Math.max(1, n - 1)))); // 0.5 -> 1.5
  }

  const sum = raw.reduce((a, b) => a + b, 0);
  const weights = {};
  for (let i = 0; i < n; i++) {
    weights[toDateStr(monthDays[i])] = raw[i] / sum;
  }
  return weights;
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeGuidOrNull(value) {
  if (value == null) return null;
  const s = value.toString().trim();
  // Basic GUID check (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  const guid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return guid.test(s) ? s.toLowerCase() : null;
}

function normalizeId(value) {
  if (value == null) return null;
  const s = value.toString().trim();
  const guid = normalizeGuidOrNull(s);
  return guid ?? s;
}

function computeEffectiveHourlyCost(consultant) {
  const payType = (consultant?.PayType ?? '').toString().trim().toLowerCase();
  const payRate = safeNum(consultant?.PayRate);
  const hourlyRate = safeNum(consultant?.HourlyRate);
  const capacity = safeNum(consultant?.CapacityHoursPerWeek) || 40;
  const cycle = (consultant?.TimecardCycle ?? '').toString().trim().toLowerCase();

  // Hourly always wins
  if (payType === 'hourly') {
    return hourlyRate || payRate || 0;
  }

  // Treat salary/flat-rate as a periodic amount, annualized based on TimecardCycle
  const isSalaryLike = payType === 'salary' || payType === 'flat' || payType === 'fixed' || payType === 'salary/flat';
  if (isSalaryLike) {
    if (capacity <= 0) return 0;

    let periodsPerYear = 12; // default monthly
    if (cycle.includes('bi')) periodsPerYear = 26;
    else if (cycle.includes('semi')) periodsPerYear = 24;
    else if (cycle.includes('week')) periodsPerYear = 52;
    else if (cycle.includes('month')) periodsPerYear = 12;
    else if (cycle.includes('quarter')) periodsPerYear = 4;
    else if (cycle.includes('ann')) periodsPerYear = 1;

    const annual = payRate * periodsPerYear;
    const annualHours = capacity * 52;
    if (annualHours <= 0) return 0;
    return annual / annualHours;
  }

  // Fallback (legacy): if HourlyRate exists, use it; otherwise PayRate as hourly.
  return hourlyRate || payRate || 0;
}

function buildIssueKey({ issueType, periodStart, periodEnd, clientId, consultantId, role }) {
  const rid = normalizeRole(role || '');
  return `${issueType}|${periodStart}|${periodEnd}|${clientId ?? 'null'}|${consultantId ?? 'null'}|${rid}`;
}

class PerformanceReport {
  static async getPerformanceReport({
    startDate,
    endDate,
    asOfDate,
    clientIds = [],
    consultantIds = [],
    role = null,
    includeSubmitted = false,
    businessDaysOnly = true,
  }) {
    const start = parseDateInput(startDate);
    const end = parseDateInput(endDate);
    let asOf = asOfDate ? parseDateInput(asOfDate) : null;

    if (!start || !end) throw new Error('Invalid startDate or endDate (expected YYYY-MM-DD)');
    if (end.isBefore(start, 'day')) throw new Error('endDate must be on or after startDate');
    if (!asOf) asOf = end;
    if (asOf.isAfter(end, 'day')) asOf = end;
    if (asOf.isBefore(start, 'day')) asOf = start;

    const today = dayjs().startOf('day');

    const settings = await GlobalSetting.getPerformanceReportingSettings();
    const warnPct = Number(settings?.HoursVarianceWarnPct ?? 0.05);
    const critPct = Number(settings?.HoursVarianceCriticalPct ?? 0.15);
    const attentionRiskDays = Number(settings?.AttentionRiskDays ?? 7);
    const gmVarianceThreshold = Number(settings?.GMVarianceThresholdPct ?? 0.05);

    const holidays = await HolidayCalendar.getAll();
    const holidaySet = buildHolidaySet(holidays);

    const pool = await poolPromise;

    const clientIdSet = new Set((Array.isArray(clientIds) ? clientIds : []).map(normalizeId).filter(Boolean));
    const consultantIdSet = new Set((Array.isArray(consultantIds) ? consultantIds : []).map(normalizeId).filter(Boolean));

    const roleFilterNorm = role ? normalizeRole(role) : null;

    // Clients
    const clientsResult = await pool.request().query(`
      SELECT ClientID, ClientName, ActiveStatus
      FROM Client
    `);

    const allClientsRaw = clientsResult.recordset ?? [];
    const allClients = allClientsRaw.map(c => ({
      ClientID: normalizeId(c.ClientID),
      ClientName: c.ClientName,
      ActiveStatus: c.ActiveStatus,
    }));

    const clients = allClients.filter(c => (clientIdSet.size ? clientIdSet.has(c.ClientID) : true));

    const clientNameById = new Map(clients.map(c => [c.ClientID, c.ClientName]));
    // Convert ActiveStatus (bit/boolean) to status string
    const clientStatusById = new Map(clients.map(c => [c.ClientID, (c.ActiveStatus === 1 || c.ActiveStatus === true || c.ActiveStatus === '1' ? 'Active' : 'Inactive')]));

    // Special internal clients (always recognized even if filtered out)
    const timeOffClient = allClients.find(c => normalizeRole(c.ClientName) === 'x - time off');
    const internalClient = allClients.find(c => normalizeRole(c.ClientName) === 'x - cfo worx');
    const timeOffClientId = timeOffClient?.ClientID ?? null;
    const internalClientId = internalClient?.ClientID ?? null;

    // Consultants
    const consultantsResult = await pool.request().query(`
      SELECT ConsultantID, FirstName, LastName, JobTitle, PayType, PayRate, HourlyRate, TimecardCycle,
             Status, Category, CapacityHoursPerWeek
      FROM Consultant
    `);

    const allConsultantsRaw = consultantsResult.recordset ?? [];
    console.log('PerformanceReport - Raw consultants from DB:', allConsultantsRaw.length);
    if (allConsultantsRaw.length > 0) {
      console.log('PerformanceReport - Sample raw consultant:', JSON.stringify(allConsultantsRaw[0], null, 2));
      console.log('PerformanceReport - All consultant statuses:', allConsultantsRaw.slice(0, 5).map(c => ({ 
        id: c.ConsultantID, 
        status: c.Status, 
        statusType: typeof c.Status,
        name: `${c.FirstName} ${c.LastName}` 
      })));
    }
    
    const allConsultants = allConsultantsRaw
      .map(c => ({
        ...c,
        ConsultantID: normalizeId(c.ConsultantID),
      }))
      .filter(c => {
        // More lenient status check - treat null/undefined/empty as Active
        const status = (c.Status ?? 'Active').toString().trim();
        const isActive = !status || status === '' || status.toLowerCase() === 'active' || status === '1' || status === 'true';
        if (!isActive && allConsultantsRaw.length <= 10) {
          console.log(`PerformanceReport - Filtered out consultant ${c.FirstName} ${c.LastName}: Status="${status}"`);
        }
        return isActive;
      });

    console.log('PerformanceReport - consultantIdSet:', Array.from(consultantIdSet));
    console.log('PerformanceReport - allConsultants count:', allConsultants.length);
    console.log('PerformanceReport - allConsultants IDs:', allConsultants.map(c => c.ConsultantID));

    const consultants = allConsultants.filter(c => (consultantIdSet.size ? consultantIdSet.has(c.ConsultantID) : true));
    
    console.log('PerformanceReport - filtered consultants count:', consultants.length);
    console.log('PerformanceReport - filtered consultants:', consultants.map(c => ({ id: c.ConsultantID, name: `${c.FirstName} ${c.LastName}` })));

    const consultantById = new Map(consultants.map(c => [c.ConsultantID, c]));
    const consultantNameById = new Map(
      consultants.map(c => [c.ConsultantID, `${c.FirstName ?? ''} ${c.LastName ?? ''}`.trim()])
    );
    const consultantCostRateById = new Map(consultants.map(c => [c.ConsultantID, computeEffectiveHourlyCost(c)]));

    // Contracts
    const contractsResult = await pool.request().query(`SELECT * FROM Contract`);
    const allContractsRaw = contractsResult.recordset ?? [];
    const allContracts = allContractsRaw.map(ct => ({
      ...ct,
      ClientID: normalizeId(ct.ClientID),
    }));
    const contracts = allContracts.filter(ct => clientNameById.has(ct.ClientID));

    // Benchmarks (current + history)
    const benchmarksResult = await pool.request().query(`
      SELECT BenchmarkID, ClientID, ConsultantID, Role, LowRangeHours, TargetHours, HighRangeHours,
             BillRate, EffectiveDate, WeeklyHours, calculatedBenchmark, DistributionType
      FROM Benchmark
      UNION ALL
      SELECT BenchmarkID, ClientID, ConsultantID, Role, LowRangeHours, TargetHours, HighRangeHours,
             BillRate, EffectiveDate, WeeklyHours, calculatedBenchmark, DistributionType
      FROM BenchmarkHistory
    `);

    const allBenchmarkVersions = (benchmarksResult.recordset ?? [])
      .map(b => ({
        ...b,
        ClientID: normalizeId(b.ClientID),
        ConsultantID: normalizeId(b.ConsultantID),
        BenchmarkID: normalizeId(b.BenchmarkID),
      }))
      .filter(b => clientNameById.has(b.ClientID))
      .filter(b => consultantById.has(b.ConsultantID));

    // Versions map: key -> sorted versions
    const versionsByKey = new Map();
    for (const b of allBenchmarkVersions) {
      const key = `${b.ClientID}|${b.ConsultantID}|${normalizeRole(b.Role)}`;
      const arr = versionsByKey.get(key) ?? [];
      arr.push({
        benchmarkId: b.BenchmarkID,
        clientId: b.ClientID,
        consultantId: b.ConsultantID,
        role: (b.Role ?? '').toString().trim(),
        roleNorm: normalizeRole(b.Role),
        low: safeNum(b.LowRangeHours),
        target: safeNum(b.TargetHours),
        high: safeNum(b.HighRangeHours),
        billRate: safeNum(b.BillRate),
        weeklyHours: safeNum(b.WeeklyHours),
        calculatedBenchmark: Boolean(b.calculatedBenchmark),
        distributionType: (b.DistributionType ?? settings.DefaultDistributionType ?? 'linear').toString(),
        effectiveDate: parseDateInput(b.EffectiveDate) ?? dayjs('1900-01-01'),
      });
      versionsByKey.set(key, arr);
    }
    for (const [key, arr] of versionsByKey.entries()) {
      arr.sort((a, b) => a.effectiveDate.valueOf() - b.effectiveDate.valueOf());
      versionsByKey.set(key, arr);
    }

    function getVersionForDate(key, date) {
      const arr = versionsByKey.get(key);
      if (!arr || arr.length === 0) return null;
      let chosen = null;
      for (const v of arr) {
        if (v.effectiveDate.isSameOrBefore(date, 'day')) chosen = v;
        else break;
      }
      return chosen;
    }

    // Timecards aggregated by day + client + consultant
    const statusList = includeSubmitted ? ['Approved', 'Submitted'] : ['Approved'];
    const request = pool.request()
      .input('StartDate', sql.Date, start.format('YYYY-MM-DD'))
      .input('EndDate', sql.Date, end.format('YYYY-MM-DD'));

    const statusParams = statusList.map((s, idx) => {
      const p = `Status${idx}`;
      request.input(p, sql.NVarChar(20), s);
      return `@${p}`;
    });

    const timecardsResult = await request.query(`
      SELECT TimesheetDate, ClientID, ConsultantID, ProjectID,
             SUM(COALESCE(ClientFacingHours,0)) AS ClientFacingHours,
             SUM(COALESCE(NonClientFacingHours,0)) AS NonClientFacingHours,
             SUM(COALESCE(OtherTaskHours,0)) AS OtherHours,
             SUM(COALESCE(ClientFacingHours,0)+COALESCE(NonClientFacingHours,0)+COALESCE(OtherTaskHours,0)) AS TotalHours
      FROM TimecardLines
      WHERE TimesheetDate BETWEEN @StartDate AND @EndDate
        AND Status IN (${statusParams.join(',')})
      GROUP BY TimesheetDate, ClientID, ConsultantID, ProjectID
    `);

    const timecardRows = (timecardsResult.recordset ?? [])
      .map(r => ({
        workDate: parseDateInput(r.TimesheetDate),
        workDateStr: toDateStr(r.TimesheetDate),
        clientId: normalizeId(r.ClientID),
        consultantId: normalizeId(r.ConsultantID),
        projectId: r.ProjectID != null ? normalizeId(r.ProjectID) : null,
        clientFacingHours: safeNum(r.ClientFacingHours),
        nonClientFacingHours: safeNum(r.NonClientFacingHours),
        otherHours: safeNum(r.OtherHours),
        totalHours: safeNum(r.TotalHours),
      }))
      .filter(r => r.workDate) // valid date
      .filter(r => consultantById.has(r.consultantId))
      .filter(r => clientNameById.has(r.clientId) || r.clientId === timeOffClientId || r.clientId === internalClientId);

    // Month cache: monthKey -> {monthDays, weightsByType}
    const months = new Map();
    for (const d of enumerateDays(start, end)) {
      const mk = getMonthKey(d);
      if (!months.has(mk)) {
        const monthDays = getMonthDays(d, businessDaysOnly, holidaySet);
        months.set(mk, { monthDays, weightsByType: new Map() });
      }
    }
    function getWeights(monthKey, distributionType) {
      const m = months.get(monthKey);
      if (!m) return {};
      const type = normalizeRole(distributionType || 'linear');
      if (!m.weightsByType.has(type)) {
        m.weightsByType.set(type, getDistributionWeights(m.monthDays, type));
      }
      return m.weightsByType.get(type);
    }

    const periodDays = enumerateDays(start, end); // all days for reporting/trend
    const toDateDays = enumerateDays(start, asOf);
    const earningDays = periodDays.filter(d => isWorkingDay(d, businessDaysOnly, holidaySet));
    const earningToDateDays = toDateDays.filter(d => isWorkingDay(d, businessDaysOnly, holidaySet));

    const periodStartStr = start.format('YYYY-MM-DD');
    const periodEndStr = end.format('YYYY-MM-DD');

    // Expected hours accumulators by benchmark key
    const expectedByKey = new Map();
    for (const key of versionsByKey.keys()) {
      const parts = key.split('|');
      const roleNormKey = (parts[2] ?? "").toString();
      if (roleFilterNorm && roleNormKey !== roleFilterNorm) continue;
      const vAtEnd = getVersionForDate(key, end);
      if (!vAtEnd) continue;
      const [clientId, consultantId, roleNorm] = key.split('|');
      expectedByKey.set(key, {
        clientId,
        consultantId,
        roleNorm,
        roleDisplay: vAtEnd.role,
        distributionType: vAtEnd.distributionType,
        billRate: vAtEnd.billRate,
        lowPeriod: 0,
        targetPeriod: 0,
        highPeriod: 0,
        lowToDate: 0,
        targetToDate: 0,
        highToDate: 0,
      });
    }

    // Compute expected hours (low/target/high) on earning days
    for (const day of earningDays) {
      const mk = getMonthKey(day);
      const ds = toDateStr(day);

      for (const key of expectedByKey.keys()) {
        const v = getVersionForDate(key, day);
        if (!v) continue;

        // Suppress forward-looking expectations for inactive clients
        const cStatus = (clientStatusById.get(v.clientId) ?? 'Active').toString().toLowerCase();
        if (cStatus !== 'active' && day.isAfter(today, 'day')) continue;

        const weights = getWeights(mk, v.distributionType);
        const w = weights[ds] ?? 0;
        if (w <= 0) continue;

        const acc = expectedByKey.get(key);
        acc.roleDisplay = v.role;
        acc.distributionType = v.distributionType;
        acc.billRate = v.billRate;

        acc.lowPeriod += v.low * w;
        acc.targetPeriod += v.target * w;
        acc.highPeriod += v.high * w;

        if (day.isSameOrBefore(asOf, 'day')) {
          acc.lowToDate += v.low * w;
          acc.targetToDate += v.target * w;
          acc.highToDate += v.high * w;
        }
      }
    }

    // Actual hours allocation
    const keysByClientConsultant = new Map(); // cc -> [roleKeys]
    for (const key of expectedByKey.keys()) {
      const [clientId, consultantId] = key.split('|');
      const cc = `${clientId}|${consultantId}`;
      const arr = keysByClientConsultant.get(cc) ?? [];
      arr.push(key);
      keysByClientConsultant.set(cc, arr);
    }

    const actualByKey = new Map();
    function ensureActual(key) {
      if (!actualByKey.has(key)) {
        const [clientId, consultantId, roleNorm] = key.split('|');
        actualByKey.set(key, {
          clientId,
          consultantId,
          roleNorm,
          actualPeriod: 0,
          actualToDate: 0,
          actualDaily: new Map(),
        });
      }
      return actualByKey.get(key);
    }

    const timeOffHoursByConsultant = new Map();
    const internalHoursByConsultant = new Map();

    for (const row of timecardRows) {
      const day = row.workDate;
      if (!day) continue;

      // Time off
      if (timeOffClientId && row.clientId === timeOffClientId) {
        const cur = timeOffHoursByConsultant.get(row.consultantId) ?? { period: 0, toDate: 0 };
        cur.period += row.totalHours;
        if (day.isSameOrBefore(asOf, 'day')) cur.toDate += row.totalHours;
        timeOffHoursByConsultant.set(row.consultantId, cur);
        continue;
      }

      // Internal
      if (internalClientId && row.clientId === internalClientId) {
        const cur = internalHoursByConsultant.get(row.consultantId) ?? { period: 0, toDate: 0 };
        cur.period += row.totalHours;
        if (day.isSameOrBefore(asOf, 'day')) cur.toDate += row.totalHours;
        internalHoursByConsultant.set(row.consultantId, cur);
        continue;
      }

      const cc = `${row.clientId}|${row.consultantId}`;
      const roleKeys = (keysByClientConsultant.get(cc) ?? []).filter(k => !!getVersionForDate(k, day));

      if (roleKeys.length === 0) {
        const key = `${row.clientId}|${row.consultantId}|__unbenchmarked__`;
        const acc = ensureActual(key);
        acc.actualPeriod += row.totalHours;
        acc.actualDaily.set(row.workDateStr, (acc.actualDaily.get(row.workDateStr) ?? 0) + row.totalHours);
        if (day.isSameOrBefore(asOf, 'day')) acc.actualToDate += row.totalHours;
        continue;
      }

      if (roleKeys.length === 1) {
        const key = roleKeys[0];
        const acc = ensureActual(key);
        acc.actualPeriod += row.totalHours;
        acc.actualDaily.set(row.workDateStr, (acc.actualDaily.get(row.workDateStr) ?? 0) + row.totalHours);
        if (day.isSameOrBefore(asOf, 'day')) acc.actualToDate += row.totalHours;
        continue;
      }

      // Multiple roles: allocate by monthly target hours for that day/version
      let sumTargets = 0;
      const targets = [];
      for (const k of roleKeys) {
        const v = getVersionForDate(k, day);
        const t = v ? safeNum(v.target) : 0;
        targets.push({ key: k, target: t });
        sumTargets += t;
      }

      for (const t of targets) {
        const share = sumTargets > 0 ? (t.target / sumTargets) : (1 / targets.length);
        const alloc = row.totalHours * share;
        const acc = ensureActual(t.key);
        acc.actualPeriod += alloc;
        acc.actualDaily.set(row.workDateStr, (acc.actualDaily.get(row.workDateStr) ?? 0) + alloc);
        if (day.isSameOrBefore(asOf, 'day')) acc.actualToDate += alloc;
      }
    }

    // Revenue mapping via contracts
    const revenueByKey = new Map();
    const softwareRevenueByKey = new Map(); // Separate tracking for software revenue
    const softwareCostByKey = new Map(); // Separate tracking for software COGS
    
    function ensureRevenue(key) {
      if (!revenueByKey.has(key)) {
        const [clientId, consultantId, roleNorm] = key.split('|');
        revenueByKey.set(key, {
          clientId,
          consultantId,
          roleNorm,
          revenuePeriod: 0,
          revenueToDate: 0,
          revenueDaily: new Map(),
          contractTypeHint: null,
          billRate: 0,
        });
      }
      return revenueByKey.get(key);
    }
    
    function ensureSoftwareRevenue(key) {
      if (!softwareRevenueByKey.has(key)) {
        const [clientId, consultantId, roleNorm] = key.split('|');
        softwareRevenueByKey.set(key, {
          clientId,
          consultantId,
          roleNorm,
          revenuePeriod: 0,
          revenueToDate: 0,
          revenueDaily: new Map(),
        });
      }
      return softwareRevenueByKey.get(key);
    }
    
    function ensureSoftwareCost(key) {
      if (!softwareCostByKey.has(key)) {
        const [clientId, consultantId, roleNorm] = key.split('|');
        softwareCostByKey.set(key, {
          clientId,
          consultantId,
          roleNorm,
          costPeriod: 0,
          costToDate: 0,
          costDaily: new Map(),
        });
      }
      return softwareCostByKey.get(key);
    }
    
    function addSoftwareRevenue(key, dateStr, amount, isToDate) {
      const acc = ensureSoftwareRevenue(key);
      acc.revenuePeriod += amount;
      acc.revenueDaily.set(dateStr, (acc.revenueDaily.get(dateStr) ?? 0) + amount);
      if (isToDate) acc.revenueToDate += amount;
    }
    
    function addSoftwareCost(key, dateStr, amount, isToDate) {
      const acc = ensureSoftwareCost(key);
      acc.costPeriod += amount;
      acc.costDaily.set(dateStr, (acc.costDaily.get(dateStr) ?? 0) + amount);
      if (isToDate) acc.costToDate += amount;
    }

    function addRevenue(key, dateStr, amount, isToDate) {
      const acc = ensureRevenue(key);
      acc.revenuePeriod += amount;
      acc.revenueDaily.set(dateStr, (acc.revenueDaily.get(dateStr) ?? 0) + amount);
      if (isToDate) acc.revenueToDate += amount;
    }

    function contractOverlapsPeriod(contract) {
      const cs = contract.ContractStartDate ? parseDateInput(contract.ContractStartDate) : null;
      const ce = contract.ContractEndDate ? parseDateInput(contract.ContractEndDate) : null;
      if (!cs) return false;
      const contractStart = cs;
      const contractEnd = ce ?? dayjs('2999-12-31');
      return contractStart.isSameOrBefore(end, 'day') && contractEnd.isSameOrAfter(start, 'day');
    }

    for (const ct of contracts) {
      if (!contractOverlapsPeriod(ct)) continue;

      const clientId = ct.ClientID;
      const clientStatus = (clientStatusById.get(clientId) ?? 'Active').toString();
      const contractType = (ct.ContractType ?? '').toString();
      const contractStart = parseDateInput(ct.ContractStartDate);
      const contractEnd = ct.ContractEndDate ? parseDateInput(ct.ContractEndDate) : dayjs('2999-12-31');

      const lineItems = [];

      // Assigned roles (consultant-linked if a GUID is stored)
      const cfoId = normalizeGuidOrNull(ct.AssignedCFO) ?? UNASSIGNED;
      if (ct.AssignedCFO && safeNum(ct.AssignedCFORate) > 0) {
        lineItems.push({ role: 'CFO', consultantId: cfoId, rate: safeNum(ct.AssignedCFORate), quantity: 1 });
      }
      const controllerId = normalizeGuidOrNull(ct.AssignedController) ?? UNASSIGNED;
      if (ct.AssignedController && safeNum(ct.AssignedControllerRate) > 0) {
        lineItems.push({ role: 'Controller', consultantId: controllerId, rate: safeNum(ct.AssignedControllerRate), quantity: 1 });
      }
      const saId = normalizeGuidOrNull(ct.AssignedSeniorAccountant) ?? UNASSIGNED;
      if (ct.AssignedSeniorAccountant && safeNum(ct.AssignedSeniorAccountantRate) > 0) {
        lineItems.push({ role: 'Senior Accountant', consultantId: saId, rate: safeNum(ct.AssignedSeniorAccountantRate), quantity: 1 });
      }

      // Software (unassigned to a consultant)
      // Track software revenue separately - allow "provided free" cases (rate = 0 but cost may exist)
      const softwareRate = safeNum(ct.AssignedSoftwareRate) ?? 0;
      const softwareCost = safeNum(ct.AssignedSoftwareCost) ?? 0;
      const softwareProvidedFree = Boolean(ct.AssignedSoftwareProvidedFree);
      const softwareName = (ct.AssignedSoftware ?? 'Software').toString();
      const qty = ct.AssignedSoftwareQuantity != null ? safeNum(ct.AssignedSoftwareQuantity) : 1;
      
      // Add software line item if there's revenue OR cost (to track "provided free" cases)
      if (softwareRate > 0 || softwareCost > 0 || softwareProvidedFree) {
        lineItems.push({
          role: `Software: ${softwareName}`,
          consultantId: UNASSIGNED,
          rate: softwareRate, // Revenue rate
          quantity: qty,
          softwareCost: softwareCost, // COGS
          softwareProvidedFree: softwareProvidedFree,
        });
      }

      // Additional staff (JSON)
      if (ct.AdditionalStaff) {
        try {
          const additional = typeof ct.AdditionalStaff === 'string' ? JSON.parse(ct.AdditionalStaff) : ct.AdditionalStaff;
          if (Array.isArray(additional)) {
            for (const s of additional) {
              const rate = safeNum(s?.rate ?? s?.Rate);
              if (rate > 0) {
                const role = (s?.role ?? s?.Role ?? 'Additional Staff').toString();
                const name = (s?.name ?? s?.Name ?? '').toString().trim();
                const roleLabel = name ? `${role}: ${name}` : role;
                lineItems.push({
                  role: roleLabel,
                  consultantId: UNASSIGNED,
                  rate,
                  quantity: 1,
                });
              }
            }
          }
        } catch (e) {
          // ignore malformed JSON
        }
      }

      const onboardingFee = safeNum(ct.OnboardingFee);
      const startMonthKey = contractStart ? getMonthKey(contractStart) : null;

      if (contractType.toLowerCase() === 'recurring') {
        // Group days by month for proper proration
        const daysByMonth = new Map();
        for (const day of earningDays) {
          // Suppress forward-looking for inactive clients
          if (clientStatus.toLowerCase() !== 'active' && day.isAfter(today, 'day')) continue;

          if (day.isBefore(contractStart, 'day') || day.isAfter(contractEnd, 'day')) continue;

          const mk = getMonthKey(day);
          if (!daysByMonth.has(mk)) {
            daysByMonth.set(mk, []);
          }
          daysByMonth.get(mk).push(day);
        }

        // Process each month with proper proration
        for (const [mk, monthDaysList] of daysByMonth.entries()) {
          const monthDays = months.get(mk)?.monthDays ?? [];
          const totalMonthDays = monthDays.length || 1;
          
          // Count actual contract days in this month
          const contractDaysInMonth = monthDaysList.length;
          
          // Calculate prorated monthly amount
          const prorationFactor = contractDaysInMonth / totalMonthDays;

          for (const li of lineItems) {
            const isSoftware = (li.role || '').toString().startsWith('Software:');
            const monthlyAmount = li.rate * (li.quantity ?? 1);
            const proratedAmount = monthlyAmount * prorationFactor;
            const dailyAmount = contractDaysInMonth > 0 ? proratedAmount / contractDaysInMonth : 0;
            
            // Software cost (COGS) - prorated monthly
            const softwareCost = isSoftware ? (safeNum(li.softwareCost) ?? 0) : 0;
            const monthlySoftwareCost = softwareCost;
            const proratedSoftwareCost = monthlySoftwareCost * prorationFactor;
            const dailySoftwareCost = contractDaysInMonth > 0 ? proratedSoftwareCost / contractDaysInMonth : 0;

            for (const day of monthDaysList) {
              const key = `${clientId}|${li.consultantId}|${normalizeRole(li.role)}`;
              
              if (isSoftware) {
                // Track software revenue separately
                addSoftwareRevenue(key, toDateStr(day), dailyAmount, day.isSameOrBefore(asOf, 'day'));
                // Track software cost (COGS) separately
                if (dailySoftwareCost > 0) {
                  addSoftwareCost(key, toDateStr(day), dailySoftwareCost, day.isSameOrBefore(asOf, 'day'));
                }
                // Also add to regular revenue for backward compatibility
                addRevenue(key, toDateStr(day), dailyAmount, day.isSameOrBefore(asOf, 'day'));
                ensureRevenue(key).contractTypeHint = 'Software';
              } else {
                addRevenue(key, toDateStr(day), dailyAmount, day.isSameOrBefore(asOf, 'day'));
                ensureRevenue(key).contractTypeHint = 'Recurring';
              }
            }
          }

          // Handle onboarding fee (only in first month of contract)
          if (onboardingFee > 0 && startMonthKey && mk === startMonthKey) {
            const proratedOnboardingFee = onboardingFee * prorationFactor;
            const dailyOnboardingAmount = contractDaysInMonth > 0 ? proratedOnboardingFee / contractDaysInMonth : 0;
            
            for (const day of monthDaysList) {
              const key = `${clientId}|${UNASSIGNED}|${normalizeRole('Onboarding Fee')}`;
              addRevenue(key, toDateStr(day), dailyOnboardingAmount, day.isSameOrBefore(asOf, 'day'));
              ensureRevenue(key).contractTypeHint = 'Recurring';
            }
          }
        }
      } else if (contractType.toLowerCase() === 'project') {
        const completion = contractEnd;
        const fee = safeNum(ct.TotalProjectFee);
        // Project revenue is earned at completion (earned-at-completion)
        // Recognize revenue on completion date if:
        // 1. Completion date is within the reporting period, OR
        // 2. Completion date is before the period but contract was active during period (recognize at period start)
        // 3. Completion date is after period but contract started before period end (recognize at period end if asOf >= completion)
        if (fee > 0 && completion) {
          let recognitionDate = null;
          let shouldRecognize = false;

          if (completion.isSameOrAfter(start, 'day') && completion.isSameOrBefore(end, 'day')) {
            // Completion within period - recognize on completion date
            recognitionDate = completion;
            shouldRecognize = true;
          } else if (completion.isBefore(start, 'day') && contractStart.isBefore(end, 'day')) {
            // Completed before period but contract was active during period - recognize at period start
            recognitionDate = start;
            shouldRecognize = true;
          } else if (completion.isAfter(end, 'day') && contractStart.isSameOrBefore(end, 'day')) {
            // Will complete after period but contract started before period end
            // Only recognize if asOf date is on or after completion date
            if (asOf.isSameOrAfter(completion, 'day')) {
              recognitionDate = completion;
              shouldRecognize = true;
            }
          }

          if (shouldRecognize && recognitionDate) {
            const key = `${clientId}|${UNASSIGNED}|${normalizeRole('Project Fee')}`;
            // Only add revenue if recognition date is within the period or at period boundaries
            if (recognitionDate.isSameOrAfter(start, 'day') && recognitionDate.isSameOrBefore(end, 'day')) {
              addRevenue(key, toDateStr(recognitionDate), fee, recognitionDate.isSameOrBefore(asOf, 'day'));
              ensureRevenue(key).contractTypeHint = 'Project';
            } else if (recognitionDate.isBefore(start, 'day')) {
              // Recognize at period start for historical completion
              addRevenue(key, toDateStr(start), fee, true);
              ensureRevenue(key).contractTypeHint = 'Project';
            }
          }
        }
      } else if (contractType.toLowerCase() === 'hourly') {
        for (const li of lineItems) {
          const key = `${clientId}|${li.consultantId}|${normalizeRole(li.role)}`;
          const r = ensureRevenue(key);
          r.contractTypeHint = 'Hourly';
          r.billRate = safeNum(li.rate);
        }
      } else {
        // default treat as recurring with proper mid-month proration
        const daysByMonth = new Map();
        for (const day of earningDays) {
          if (clientStatus.toLowerCase() !== 'active' && day.isAfter(today, 'day')) continue;
          if (day.isBefore(contractStart, 'day') || day.isAfter(contractEnd, 'day')) continue;

          const mk = getMonthKey(day);
          if (!daysByMonth.has(mk)) {
            daysByMonth.set(mk, []);
          }
          daysByMonth.get(mk).push(day);
        }

        // Process each month with proper proration
        for (const [mk, monthDaysList] of daysByMonth.entries()) {
          const monthDays = months.get(mk)?.monthDays ?? [];
          const totalMonthDays = monthDays.length || 1;
          const contractDaysInMonth = monthDaysList.length;
          const prorationFactor = contractDaysInMonth / totalMonthDays;

          for (const li of lineItems) {
            const isSoftware = (li.role || '').toString().startsWith('Software:');
            const monthlyAmount = li.rate * (li.quantity ?? 1);
            const proratedAmount = monthlyAmount * prorationFactor;
            const dailyAmount = contractDaysInMonth > 0 ? proratedAmount / contractDaysInMonth : 0;
            
            // Software cost (COGS)
            const softwareCost = isSoftware ? (safeNum(li.softwareCost) ?? 0) : 0;
            const monthlySoftwareCost = softwareCost;
            const proratedSoftwareCost = monthlySoftwareCost * prorationFactor;
            const dailySoftwareCost = contractDaysInMonth > 0 ? proratedSoftwareCost / contractDaysInMonth : 0;

            for (const day of monthDaysList) {
              const key = `${clientId}|${li.consultantId}|${normalizeRole(li.role)}`;
              
              if (isSoftware) {
                addSoftwareRevenue(key, toDateStr(day), dailyAmount, day.isSameOrBefore(asOf, 'day'));
                if (dailySoftwareCost > 0) {
                  addSoftwareCost(key, toDateStr(day), dailySoftwareCost, day.isSameOrBefore(asOf, 'day'));
                }
                addRevenue(key, toDateStr(day), dailyAmount, day.isSameOrBefore(asOf, 'day'));
                ensureRevenue(key).contractTypeHint = 'Software';
              } else {
                addRevenue(key, toDateStr(day), dailyAmount, day.isSameOrBefore(asOf, 'day'));
                ensureRevenue(key).contractTypeHint = contractType || 'Recurring';
              }
            }
          }
        }
      }
    }

    // Hourly contract revenue: actual hours * billRate
    for (const [key, rev] of revenueByKey.entries()) {
      if (rev.contractTypeHint !== 'Hourly') continue;
      const billRate = safeNum(rev.billRate);
      if (billRate <= 0) continue;

      const act = actualByKey.get(key);
      const hoursPeriod = act?.actualPeriod ?? 0;
      const hoursToDate = act?.actualToDate ?? 0;

      rev.revenuePeriod = hoursPeriod * billRate;
      rev.revenueToDate = hoursToDate * billRate;
      // daily omitted for hourly
    }
    // Unified assignment rows (expected + actual + revenue)
    const allKeys = new Set([...expectedByKey.keys(), ...actualByKey.keys(), ...revenueByKey.keys()]);

    // Optional role filter (applies to ALL aggregations, including trend)
    const includedKeys = new Set();
    for (const key of allKeys) {
      const parts = key.split('|');
      const roleNormRaw = (parts[2] ?? '').toString();
      if (roleFilterNorm && roleNormRaw !== roleFilterNorm) continue;
      includedKeys.add(key);
    }

    const assignmentRows = [];
    for (const key of includedKeys) {
      const [clientId, consultantId, roleNormRaw] = key.split('|');

      // Skip internal in assignment rows
      if (timeOffClientId && clientId === timeOffClientId) continue;
      if (internalClientId && clientId === internalClientId) continue;

      const clientName = clientNameById.get(clientId) ?? '(Unknown Client)';
      const consultantName =
        consultantId === UNASSIGNED
          ? '(Unassigned)'
          : (consultantNameById.get(consultantId) ?? '(Unknown Consultant)');

      const expected = expectedByKey.get(key) ?? {
        lowPeriod: 0, targetPeriod: 0, highPeriod: 0,
        lowToDate: 0, targetToDate: 0, highToDate: 0,
        billRate: 0, distributionType: 'linear',
        roleDisplay: roleNormRaw === '__unbenchmarked__' ? 'Unbenchmarked' : roleNormRaw,
      };

      const actual = actualByKey.get(key) ?? { actualPeriod: 0, actualToDate: 0 };
      const revenue = revenueByKey.get(key) ?? { revenuePeriod: 0, revenueToDate: 0, contractTypeHint: null };

      const costRate = consultantId === UNASSIGNED ? 0 : (consultantCostRateById.get(consultantId) ?? 0);

      const expectedHoursPeriod = expected.targetPeriod ?? 0;
      const expectedHoursToDate = expected.targetToDate ?? 0;
      const actualHoursPeriod = actual.actualPeriod ?? 0;
      const actualHoursToDate = actual.actualToDate ?? 0;

      const projectedHoursPeriod =
        expectedHoursPeriod > 0
          ? (actualHoursToDate + Math.max(0, expectedHoursPeriod - expectedHoursToDate))
          : (earningToDateDays.length > 0 ? (actualHoursToDate * (earningDays.length / Math.max(1, earningToDateDays.length))) : actualHoursToDate);

      const revenuePeriod = revenue.revenuePeriod ?? 0;
      const revenueToDate = revenue.revenueToDate ?? 0;
      
      // Get software revenue and cost for this assignment
      const swRev = softwareRevenueByKey.get(key);
      const swCost = softwareCostByKey.get(key);
      const softwareRevenuePeriod = swRev ? safeNum(swRev.revenuePeriod) : 0;
      const softwareRevenueToDate = swRev ? safeNum(swRev.revenueToDate) : 0;
      const softwareCostPeriod = swCost ? safeNum(swCost.costPeriod) : 0;
      const softwareCostToDate = swCost ? safeNum(swCost.costToDate) : 0;
      const isSoftware = (roleNormRaw || '').toString().startsWith('software:');

      const expectedCostPeriod = expectedHoursPeriod * costRate;
      const expectedCostToDate = expectedHoursToDate * costRate;
      const actualCostPeriod = actualHoursPeriod * costRate;
      const actualCostToDate = actualHoursToDate * costRate;
      const projectedCostPeriod = projectedHoursPeriod * costRate;

      const expectedGMPeriod = revenuePeriod - expectedCostPeriod;
      const expectedGMToDate = revenueToDate - expectedCostToDate;
      const actualGMPeriod = revenuePeriod - actualCostPeriod;
      const actualGMToDate = revenueToDate - actualCostToDate;
      const projectedGMPeriod = revenuePeriod - projectedCostPeriod;

      const varianceToDateHours = actualHoursToDate - expectedHoursToDate;
      const varianceToDatePct = expectedHoursToDate > 0 ? varianceToDateHours / expectedHoursToDate : null;

      const rangeBreach =
        actualHoursToDate < (expected.lowToDate ?? 0) ||
        actualHoursToDate > (expected.highToDate ?? Number.POSITIVE_INFINITY);

      let severity = null;
      if (rangeBreach) severity = 'critical';
      if (varianceToDatePct != null) {
        const abs = Math.abs(varianceToDatePct);
        if (abs >= critPct) severity = 'critical';
        else if (!severity && abs >= warnPct) severity = 'warning';
      }

      const roleDisplay = expected.roleDisplay || (roleNormRaw === '__unbenchmarked__' ? 'Unbenchmarked' : roleNormRaw);

      assignmentRows.push({
        key,
        clientId,
        clientName,
        consultantId,
        consultantName,
        role: roleDisplay,
        contractType: revenue.contractTypeHint ?? null,
        distributionType: expected.distributionType ?? 'linear',

        expectedHoursPeriod,
        expectedHoursToDate,
        expectedLowHoursToDate: expected.lowToDate ?? 0,
        expectedHighHoursToDate: expected.highToDate ?? 0,
        actualHoursPeriod,
        actualHoursToDate,
        projectedHoursPeriod,

        varianceToDateHours,
        varianceToDatePct,

        revenuePeriod,
        revenueToDate,
        expectedCostPeriod,
        expectedCostToDate,
        actualCostPeriod,
        actualCostToDate,
        projectedCostPeriod,
        expectedGMPeriod,
        expectedGMToDate,
        actualGMPeriod,
        actualGMToDate,
        projectedGMPeriod,
        
        // Software-specific fields
        softwareRevenuePeriod,
        softwareRevenueToDate,
        softwareCostPeriod,
        softwareCostToDate,
        softwareGMPeriod: softwareRevenuePeriod - softwareCostPeriod,
        softwareGMToDate: softwareRevenueToDate - softwareCostToDate,
        isSoftware,

        costRate,
        severity,
      });
    }

    // Aggregations
    const aggFields = [
      'expectedHoursPeriod','expectedHoursToDate','actualHoursPeriod','actualHoursToDate','projectedHoursPeriod',
      'revenuePeriod','revenueToDate',
      'expectedCostPeriod','expectedCostToDate','actualCostPeriod','actualCostToDate','projectedCostPeriod',
      'expectedGMPeriod','expectedGMToDate','actualGMPeriod','actualGMToDate','projectedGMPeriod',
    ];

    function sumFields(rows, fields) {
      const out = {};
      for (const f of fields) out[f] = 0;
      for (const r of rows) for (const f of fields) out[f] += safeNum(r[f]);
      return out;
    }

    // By client
    const byClient = [];
    const rowsByClient = new Map();
    for (const r of assignmentRows) {
      const arr = rowsByClient.get(r.clientId) ?? [];
      arr.push(r);
      rowsByClient.set(r.clientId, arr);
    }
    for (const [clientId, rows] of rowsByClient.entries()) {
      const sums = sumFields(rows, aggFields);
      
      // Calculate software revenue and cost for this client
      let clientSoftwareRevenuePeriod = 0;
      let clientSoftwareRevenueToDate = 0;
      let clientSoftwareCostPeriod = 0;
      let clientSoftwareCostToDate = 0;
      
      for (const row of rows) {
        const key = `${row.clientId}|${row.consultantId}|${normalizeRole(row.role)}`;
        const swRev = softwareRevenueByKey.get(key);
        const swCost = softwareCostByKey.get(key);
        if (swRev) {
          clientSoftwareRevenuePeriod += safeNum(swRev.revenuePeriod);
          clientSoftwareRevenueToDate += safeNum(swRev.revenueToDate);
        }
        if (swCost) {
          clientSoftwareCostPeriod += safeNum(swCost.costPeriod);
          clientSoftwareCostToDate += safeNum(swCost.costToDate);
        }
      }
      
      const varianceToDateHours = safeNum(sums.actualHoursToDate) - safeNum(sums.expectedHoursToDate);
      const varianceToDatePct = safeNum(sums.expectedHoursToDate) > 0 ? (varianceToDateHours / safeNum(sums.expectedHoursToDate)) : null;
      const varianceEomHours = safeNum(sums.projectedHoursPeriod) - safeNum(sums.expectedHoursPeriod);
      const varianceEomPct = safeNum(sums.expectedHoursPeriod) > 0 ? (varianceEomHours / safeNum(sums.expectedHoursPeriod)) : null;
      
      // Service revenue (excluding software)
      const serviceRevenuePeriod = sums.revenuePeriod - clientSoftwareRevenuePeriod;
      const serviceRevenueToDate = sums.revenueToDate - clientSoftwareRevenueToDate;
      const serviceCostPeriod = sums.actualCostPeriod - clientSoftwareCostPeriod;
      const serviceCostToDate = sums.actualCostToDate - clientSoftwareCostToDate;
      
      byClient.push({
        clientId,
        clientName: clientNameById.get(clientId) ?? '(Unknown Client)',
        ...sums,
        varianceToDateHours,
        varianceToDatePct,
        varianceEomHours,
        varianceEomPct,
        projectedGMPercent: sums.revenuePeriod ? (sums.projectedGMPeriod / sums.revenuePeriod) : null,
        expectedGMPercent: sums.revenuePeriod ? (sums.expectedGMPeriod / sums.revenuePeriod) : null,
        // Software-specific fields
        softwareRevenuePeriod: clientSoftwareRevenuePeriod,
        softwareRevenueToDate: clientSoftwareRevenueToDate,
        softwareCostPeriod: clientSoftwareCostPeriod,
        softwareCostToDate: clientSoftwareCostToDate,
        softwareGMPeriod: clientSoftwareRevenuePeriod - clientSoftwareCostPeriod,
        softwareGMToDate: clientSoftwareRevenueToDate - clientSoftwareCostToDate,
        // Service revenue (excluding software)
        serviceRevenuePeriod,
        serviceRevenueToDate,
        serviceCostPeriod,
        serviceCostToDate,
        serviceGMPeriod: serviceRevenuePeriod - serviceCostPeriod,
        serviceGMToDate: serviceRevenueToDate - serviceCostToDate,
      });
    }
    byClient.sort((a,b)=> (a.clientName || '').localeCompare(b.clientName || ''));

    // By role
    const byRole = [];
    const rowsByRole = new Map();
    for (const r of assignmentRows) {
      const role = r.role || '(Unspecified Role)';
      const arr = rowsByRole.get(role) ?? [];
      arr.push(r);
      rowsByRole.set(role, arr);
    }
    for (const [role, rows] of rowsByRole.entries()) {
      const sums = sumFields(rows, aggFields);
      const varianceToDateHours = safeNum(sums.actualHoursToDate) - safeNum(sums.expectedHoursToDate);
      const varianceToDatePct = safeNum(sums.expectedHoursToDate) > 0 ? (varianceToDateHours / safeNum(sums.expectedHoursToDate)) : null;
      const varianceEomHours = safeNum(sums.projectedHoursPeriod) - safeNum(sums.expectedHoursPeriod);
      const varianceEomPct = safeNum(sums.expectedHoursPeriod) > 0 ? (varianceEomHours / safeNum(sums.expectedHoursPeriod)) : null;
      byRole.push({
        role,
        ...sums,
        varianceToDateHours,
        varianceToDatePct,
        varianceEomHours,
        varianceEomPct,
        projectedGMPercent: sums.revenuePeriod ? (sums.projectedGMPeriod / sums.revenuePeriod) : null,
        expectedGMPercent: sums.revenuePeriod ? (sums.expectedGMPeriod / sums.revenuePeriod) : null,
      });
    }
    byRole.sort((a,b)=> (a.role || '').localeCompare(b.role || ''));

    // Utilization / capacity by consultant
    const byConsultant = [];
    for (const c of consultants) {
      const cid = c.ConsultantID;

      const capacityWeek = safeNum(c.CapacityHoursPerWeek) || 40;
      const hoursPerDay = capacityWeek / 5;

      // Paid hours: business days excluding holidays
      const businessPeriodDays = enumerateDays(start, end).filter(d => isWorkingDay(d, true, holidaySet));
      const businessToDateDays = enumerateDays(start, asOf).filter(d => isWorkingDay(d, true, holidaySet));

      const capacityPeriod = businessPeriodDays.length * hoursPerDay;
      const capacityToDate = businessToDateDays.length * hoursPerDay;

      const timeOff = timeOffHoursByConsultant.get(cid) ?? { period: 0, toDate: 0 };

      const paidHoursPeriod = Math.max(0, capacityPeriod - safeNum(timeOff.period));
      const paidHoursToDate = Math.max(0, capacityToDate - safeNum(timeOff.toDate));

      // Logged hours (excluding time off)
      let loggedPeriod = 0;
      let loggedToDate = 0;
      let clientLoggedPeriod = 0;
      let clientLoggedToDate = 0;

      for (const row of timecardRows) {
        if (row.consultantId !== cid) continue;
        if (timeOffClientId && row.clientId === timeOffClientId) continue;

        const isToDate = dayjs(row.workDate).isSameOrBefore(asOf, 'day');
        loggedPeriod += row.totalHours;
        if (isToDate) loggedToDate += row.totalHours;

        if (!(internalClientId && row.clientId === internalClientId)) {
          clientLoggedPeriod += row.totalHours;
          if (isToDate) clientLoggedToDate += row.totalHours;
        }
      }

      const benchHoursToDate = Math.max(0, paidHoursToDate - loggedToDate);
      const benchHoursPeriod = Math.max(0, paidHoursPeriod - loggedPeriod);

      const costRate = consultantCostRateById.get(cid) ?? 0;
      const payType = (c.PayType ?? '').toString().toLowerCase();
      const benchCostToDate = payType === 'salary' ? (benchHoursToDate * costRate) : 0;
      const benchCostPeriod = payType === 'salary' ? (benchHoursPeriod * costRate) : 0;

      // Assignment load from expected hours
      const assignmentRowsForConsultant = assignmentRows.filter(r => r.consultantId === cid);
      // Assignment detail (grouped by client)
      const assignmentsByClient = new Map();
      for (const r of assignmentRowsForConsultant) {
        const cur = assignmentsByClient.get(r.clientId) ?? {
          clientId: r.clientId,
          clientName: r.clientName,
          expectedHoursToDate: 0,
          actualHoursToDate: 0,
          expectedHoursPeriod: 0,
          projectedHoursPeriod: 0,
        };
        cur.expectedHoursToDate += safeNum(r.expectedHoursToDate);
        cur.actualHoursToDate += safeNum(r.actualHoursToDate);
        cur.expectedHoursPeriod += safeNum(r.expectedHoursPeriod);
        cur.projectedHoursPeriod += safeNum(r.projectedHoursPeriod);
        assignmentsByClient.set(r.clientId, cur);
      }
      const assignments = Array.from(assignmentsByClient.values()).map(a => {
        const varianceToDateHours = a.actualHoursToDate - a.expectedHoursToDate;
        const varianceToDatePct = a.expectedHoursToDate > 0 ? varianceToDateHours / a.expectedHoursToDate : null;
        return { ...a, varianceToDateHours, varianceToDatePct };
      }).sort((a,b)=> (a.clientName||'').localeCompare(b.clientName||''));

      const assignmentLoadPeriod = assignmentRowsForConsultant.reduce((sum, r) => sum + safeNum(r.expectedHoursPeriod), 0);
      const assignmentLoadToDate = assignmentRowsForConsultant.reduce((sum, r) => sum + safeNum(r.expectedHoursToDate), 0);

      const utilizationToDate = paidHoursToDate > 0 ? (clientLoggedToDate / paidHoursToDate) : null;

      byConsultant.push({
        consultantId: cid,
        consultantName: consultantNameById.get(cid) ?? `${c.FirstName ?? ''} ${c.LastName ?? ''}`.trim(),
        jobTitle: c.JobTitle ?? null,
        capacityHoursPerWeek: capacityWeek,
        paidHoursPeriod,
        paidHoursToDate,
        loggedHoursPeriod: loggedPeriod,
        loggedHoursToDate: loggedToDate,
        clientLoggedHoursPeriod: clientLoggedPeriod,
        clientLoggedHoursToDate: clientLoggedToDate,
        benchHoursPeriod,
        benchHoursToDate,
        benchCostPeriod,
        benchCostToDate,
        assignmentLoadPeriod,
        assignmentLoadToDate,
        utilizationToDate,
        assignments,
      });
    }
    byConsultant.sort((a,b)=> (a.consultantName || '').localeCompare(b.consultantName || ''));
    
    console.log('PerformanceReport - byConsultant count:', byConsultant.length);
    console.log('PerformanceReport - byConsultant sample:', byConsultant.slice(0, 3).map(c => ({ id: c.consultantId, name: c.consultantName })));

    // Summary
    const summarySums = sumFields(assignmentRows, aggFields);
    
    // Calculate software revenue and cost totals
    let softwareRevenuePeriod = 0;
    let softwareRevenueToDate = 0;
    let softwareCostPeriod = 0;
    let softwareCostToDate = 0;
    
    for (const [key, swRev] of softwareRevenueByKey.entries()) {
      softwareRevenuePeriod += safeNum(swRev.revenuePeriod);
      softwareRevenueToDate += safeNum(swRev.revenueToDate);
    }
    
    for (const [key, swCost] of softwareCostByKey.entries()) {
      softwareCostPeriod += safeNum(swCost.costPeriod);
      softwareCostToDate += safeNum(swCost.costToDate);
    }
    
    // Service revenue/cost (excluding software)
    const serviceRevenuePeriod = summarySums.revenuePeriod - softwareRevenuePeriod;
    const serviceRevenueToDate = summarySums.revenueToDate - softwareRevenueToDate;
    const serviceCostPeriod = summarySums.actualCostPeriod - softwareCostPeriod;
    const serviceCostToDate = summarySums.actualCostToDate - softwareCostToDate;

    const benchTotals = byConsultant.reduce((acc, r) => {
      acc.benchHoursToDate += safeNum(r.benchHoursToDate);
      acc.benchCostToDate += safeNum(r.benchCostToDate);
      acc.benchHoursPeriod += safeNum(r.benchHoursPeriod);
      acc.benchCostPeriod += safeNum(r.benchCostPeriod);
      return acc;
    }, { benchHoursToDate: 0, benchCostToDate: 0, benchHoursPeriod: 0, benchCostPeriod: 0 });

    // Trend series (daily totals)
    const trend = [];
    let cumExpectedHours = 0;
    let cumActualHours = 0;
    let cumRevenue = 0;
    let cumExpectedCost = 0;
    let cumActualCost = 0;
    let cumSoftwareRevenue = 0;
    let cumSoftwareCost = 0;

    const expectedDailyTotals = new Map();
    const actualDailyTotals = new Map();
    const revenueDailyTotals = new Map();
    const softwareRevenueDailyTotals = new Map();
    const softwareCostDailyTotals = new Map();

    // Populate software revenue and cost daily totals
    for (const day of periodDays) {
      const ds = toDateStr(day);
      let softwareRevenueDay = 0;
      let softwareCostDay = 0;
      
      for (const [key, swRev] of softwareRevenueByKey.entries()) {
        softwareRevenueDay += safeNum(swRev.revenueDaily.get(ds) ?? 0);
      }
      
      for (const [key, swCost] of softwareCostByKey.entries()) {
        softwareCostDay += safeNum(swCost.costDaily.get(ds) ?? 0);
      }
      
      softwareRevenueDailyTotals.set(ds, softwareRevenueDay);
      softwareCostDailyTotals.set(ds, softwareCostDay);
    }

    for (const day of periodDays) {
      const ds = toDateStr(day);
      let expectedDay = 0;

      for (const key of expectedByKey.keys()) {
        const v = getVersionForDate(key, day);
        if (!v) continue;

        const cStatus = (clientStatusById.get(v.clientId) ?? 'Active').toString().toLowerCase();
        if (cStatus !== 'active' && day.isAfter(today, 'day')) continue;

        const mk = getMonthKey(day);
        const weights = getWeights(mk, v.distributionType);
        const w = weights[ds] ?? 0;
        expectedDay += v.target * w;
      }

      expectedDailyTotals.set(ds, expectedDay);
    }

    for (const [key, acc] of actualByKey.entries()) {
      if (!includedKeys.has(key)) continue;
      for (const [ds, hrs] of acc.actualDaily.entries()) {
        actualDailyTotals.set(ds, (actualDailyTotals.get(ds) ?? 0) + hrs);
      }
    }

    for (const [key, acc] of revenueByKey.entries()) {
      if (!includedKeys.has(key)) continue;
      for (const [ds, amt] of acc.revenueDaily.entries()) {
        revenueDailyTotals.set(ds, (revenueDailyTotals.get(ds) ?? 0) + amt);
      }
    }

    const expectedCostDailyTotals = new Map();
    const actualCostDailyTotals = new Map();

    // Expected cost daily: expected hours * costRate by consultant
    for (const day of periodDays) {
      const ds = toDateStr(day);
      let expectedCost = 0;
      let actualCost = 0;

      for (const key of expectedByKey.keys()) {
        const v = getVersionForDate(key, day);
        if (!v) continue;

        const cStatus = (clientStatusById.get(v.clientId) ?? 'Active').toString().toLowerCase();
        if (cStatus !== 'active' && day.isAfter(today, 'day')) continue;

        const mk = getMonthKey(day);
        const weights = getWeights(mk, v.distributionType);
        const w = weights[ds] ?? 0;
        if (w <= 0) continue;

        const costRate = consultantCostRateById.get(v.consultantId) ?? 0;
        expectedCost += (v.target * w) * costRate;
      }

      for (const [key, acc] of actualByKey.entries()) {
        if (!includedKeys.has(key)) continue;
        const consultantId = acc.consultantId;
        if (!consultantId || consultantId === UNASSIGNED) continue;
        const costRate = consultantCostRateById.get(consultantId) ?? 0;
        const hrs = acc.actualDaily.get(ds) ?? 0;
        actualCost += hrs * costRate;
      }

      expectedCostDailyTotals.set(ds, expectedCost);
      actualCostDailyTotals.set(ds, actualCost);
    }

    for (const day of periodDays) {
      const ds = toDateStr(day);
      const expH = expectedDailyTotals.get(ds) ?? 0;
      const actH = actualDailyTotals.get(ds) ?? 0;
      const rev = revenueDailyTotals.get(ds) ?? 0;
      const expC = expectedCostDailyTotals.get(ds) ?? 0;
      const actC = actualCostDailyTotals.get(ds) ?? 0;

      cumExpectedHours += expH;
      cumActualHours += actH;
      cumRevenue += rev;
      cumExpectedCost += expC;
      cumActualCost += actC;
      
      const swRev = softwareRevenueDailyTotals.get(ds) ?? 0;
      const swCost = softwareCostDailyTotals.get(ds) ?? 0;
      cumSoftwareRevenue += swRev;
      cumSoftwareCost += swCost;

      trend.push({
        date: ds,
        expectedHoursDaily: expH,
        actualHoursDaily: actH,
        expectedHoursCumulative: cumExpectedHours,
        actualHoursCumulative: cumActualHours,
        revenueDaily: rev,
        revenueCumulative: cumRevenue,
        expectedCostDaily: expC,
        actualCostDaily: actC,
        expectedCostCumulative: cumExpectedCost,
        actualCostCumulative: cumActualCost,
        softwareRevenueDaily: swRev,
        softwareRevenueCumulative: cumSoftwareRevenue,
        softwareCostDaily: swCost,
        softwareCostCumulative: cumSoftwareCost,
      });
    }

    // Issues for the selected period
    const issues = [];
    for (const row of assignmentRows) {
      if (!row.severity) continue;

      const issueType = 'hours_variance';
      const issueKey = buildIssueKey({
        issueType,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        clientId: row.clientId,
        consultantId: row.consultantId,
        role: row.role,
      });

      issues.push({
        issueKey,
        issueType,
        severity: row.severity,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        clientId: row.clientId,
        clientName: row.clientName,
        consultantId: row.consultantId,
        consultantName: row.consultantName,
        role: row.role,
        expectedHoursToDate: row.expectedHoursToDate,
        actualHoursToDate: row.actualHoursToDate,
        varianceToDateHours: row.varianceToDateHours,
        varianceToDatePct: row.varianceToDatePct,
      });
    }

    // Utilization issues (consultant level)
    for (const r of byConsultant) {
      if (r.utilizationToDate == null) continue;
      const underUtilPct = r.paidHoursToDate > 0 ? (r.clientLoggedHoursToDate / r.paidHoursToDate) : 1;
      if (underUtilPct >= (1 - warnPct)) continue;

      const severity = underUtilPct <= (1 - critPct) ? 'critical' : 'warning';
      const issueType = 'utilization_variance';
      const issueKey = buildIssueKey({
        issueType,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        clientId: null,
        consultantId: r.consultantId,
        role: 'utilization',
      });

      issues.push({
        issueKey,
        issueType,
        severity,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        clientId: null,
        clientName: null,
        consultantId: r.consultantId,
        consultantName: r.consultantName,
        role: 'Utilization',
        actualUtilizationToDate: underUtilPct,
        benchHoursToDate: r.benchHoursToDate,
      });
    }

    // Client attention risk issues
    // Find last time logged per client (excluding time-off and internal clients)
    const lastTimeLoggedQuery = pool.request()
      .input('AsOfDate', sql.Date, asOf.format('YYYY-MM-DD'));
    
    const lastTimeLoggedResult = await lastTimeLoggedQuery.query(`
      SELECT ClientID, MAX(TimesheetDate) AS LastTimeLogged
      FROM TimecardLines
      WHERE TimesheetDate <= @AsOfDate
        AND Status IN ('Approved', 'Submitted')
        AND ClientID IS NOT NULL
      GROUP BY ClientID
    `);

    const lastTimeLoggedByClient = new Map();
    for (const row of lastTimeLoggedResult.recordset ?? []) {
      const clientId = normalizeId(row.ClientID);
      const lastLogged = parseDateInput(row.LastTimeLogged);
      if (lastLogged) {
        lastTimeLoggedByClient.set(clientId, lastLogged);
      }
    }

    // Generate attention risk issues for clients with benchmarks but no recent time logged
    for (const client of clients) {
      const clientId = client.ClientID;
      const clientName = client.ClientName;
      
      // Skip internal clients
      if (clientId === timeOffClientId || clientId === internalClientId) continue;
      
      // Only check active clients
      const clientStatus = clientStatusById.get(clientId);
      if (clientStatus !== 'Active') continue;

      // Check if client has any benchmarks (indicating expected work)
      const hasBenchmark = Array.from(versionsByKey.keys()).some(key => {
        const parts = key.split('|');
        return parts[0] === clientId;
      });
      
      if (!hasBenchmark) continue; // Skip clients without benchmarks

      const lastLogged = lastTimeLoggedByClient.get(clientId);
      const daysSinceLastLogged = lastLogged 
        ? asOf.diff(lastLogged, 'day')
        : null;

      // If never logged time, or last logged more than attentionRiskDays ago
      if (daysSinceLastLogged === null || daysSinceLastLogged > attentionRiskDays) {
        const severity = daysSinceLastLogged === null || daysSinceLastLogged > (attentionRiskDays * 2) 
          ? 'critical' 
          : 'warning';
        
        const issueType = 'attention';
        const issueKey = buildIssueKey({
          issueType,
          periodStart: periodStartStr,
          periodEnd: periodEndStr,
          clientId,
          consultantId: null,
          role: 'attention',
        });

        issues.push({
          issueKey,
          issueType,
          severity,
          periodStart: periodStartStr,
          periodEnd: periodEndStr,
          clientId,
          clientName,
          consultantId: null,
          consultantName: null,
          role: 'Attention Risk',
          daysSinceLastLogged: daysSinceLastLogged ?? 'never',
          attentionRiskDays,
        });
      }
    }

    // Trailing 3-month GM expectation issues
    // Calculate trailing GM for clients with sufficient revenue
    // OPTIMIZED: Use direct SQL queries instead of calling getPerformanceReport (which is very expensive)
    const clientsWithExpectedGM = byClient.filter(c => {
      const clientId = c.clientId;
      return clientId && 
        clientId !== timeOffClientId && 
        clientId !== internalClientId &&
        c.expectedGMPercent != null;
    });

    if (clientsWithExpectedGM.length > 0 && gmVarianceThreshold > 0) {
      const trailingStart = start.subtract(3, 'month').startOf('month');
      const trailingEnd = start.subtract(1, 'day').endOf('month');
      const trailingStartStr = trailingStart.format('YYYY-MM-DD');
      const trailingEndStr = trailingEnd.format('YYYY-MM-DD');
      
      // Batch query: Get trailing revenue and costs for all clients at once
      const clientIdsList = clientsWithExpectedGM.map(c => c.clientId);
      const clientIdsParam = clientIdsList.map((id, idx) => {
        const param = `ClientID${idx}`;
        return `@${param}`;
      }).join(',');

      const trailingRequest = pool.request();
      clientIdsList.forEach((id, idx) => {
        trailingRequest.input(`ClientID${idx}`, sql.UniqueIdentifier, id);
      });
      trailingRequest.input('StartDate', sql.Date, trailingStartStr);
      trailingRequest.input('EndDate', sql.Date, trailingEndStr);

      // Get trailing revenue from contracts (simplified - approximate for 3 months)
      // For recurring: MonthlyFee * 3 months (simplified approximation)
      // For project: TotalProjectFee if completed in period
      // This is an approximation for alerting purposes - exact calculation would require full report engine
      const trailingRevenueResult = await trailingRequest.query(`
        SELECT 
          c.ClientID,
          SUM(
            CASE 
              WHEN c.ContractType = 'Recurring' THEN COALESCE(c.MonthlyFee, 0) * 3
              WHEN c.ContractType IN ('Project', 'M&A') AND c.ContractEndDate BETWEEN @StartDate AND @EndDate THEN 
                COALESCE(c.TotalProjectFee, 0)
              ELSE 0
            END +
            COALESCE(c.AssignedCFORate, 0) +
            COALESCE(c.AssignedControllerRate, 0) +
            COALESCE(c.AssignedSeniorAccountantRate, 0) +
            COALESCE(c.AssignedSoftwareRate * NULLIF(c.AssignedSoftwareQuantity, 0), 0)
          ) AS TrailingRevenue
        FROM Contract c
        WHERE c.ClientID IN (${clientIdsParam})
          AND c.ContractEndReason IS NULL
          AND c.ContractStartDate <= @EndDate
          AND (c.ContractEndDate IS NULL OR c.ContractEndDate >= @StartDate)
        GROUP BY c.ClientID
      `);

      // Get trailing costs from timecards
      const trailingCostRequest = pool.request();
      clientIdsList.forEach((id, idx) => {
        trailingCostRequest.input(`ClientID${idx}`, sql.UniqueIdentifier, id);
      });
      trailingCostRequest.input('StartDate', sql.Date, trailingStartStr);
      trailingCostRequest.input('EndDate', sql.Date, trailingEndStr);
      trailingCostRequest.input('Status', sql.NVarChar(20), 'Approved');

      const trailingCostResult = await trailingCostRequest.query(`
        SELECT 
          tl.ClientID,
          SUM(tl.TotalHours * ISNULL(c.HourlyRate, c.PayRate / 40)) AS TrailingCost
        FROM TimecardLines tl
        JOIN Consultant c ON tl.ConsultantID = c.ConsultantID
        WHERE tl.ClientID IN (${clientIdsParam})
          AND tl.TimesheetDate BETWEEN @StartDate AND @EndDate
          AND tl.Status = @Status
        GROUP BY tl.ClientID
      `);

      // Build maps for O(1) lookup
      const trailingRevenueByClient = new Map();
      for (const row of trailingRevenueResult.recordset ?? []) {
        const clientId = normalizeId(row.ClientID);
        trailingRevenueByClient.set(clientId, safeNum(row.TrailingRevenue));
      }

      const trailingCostByClient = new Map();
      for (const row of trailingCostResult.recordset ?? []) {
        const clientId = normalizeId(row.ClientID);
        trailingCostByClient.set(clientId, safeNum(row.TrailingCost));
      }

      // Process each client
      for (const client of clientsWithExpectedGM) {
        const clientId = client.clientId;
        const expectedGMPct = client.expectedGMPercent;
        
        const trailingRevenue = trailingRevenueByClient.get(clientId) ?? 0;
        const trailingCost = trailingCostByClient.get(clientId) ?? 0;
        
        if (trailingRevenue > 1000) { // Only check if sufficient revenue
          const trailingGM = trailingRevenue - trailingCost;
          const trailingGMPct = trailingRevenue > 0 ? trailingGM / trailingRevenue : 0;
          const gmVariancePct = trailingGMPct - expectedGMPct;
          const absVariance = Math.abs(gmVariancePct);

          if (absVariance > gmVarianceThreshold) {
            const severity = absVariance > (gmVarianceThreshold * 2) ? 'critical' : 'warning';
            const issueType = 'gm_variance';
            const issueKey = buildIssueKey({
              issueType,
              periodStart: periodStartStr,
              periodEnd: periodEndStr,
              clientId,
              consultantId: null,
              role: 'trailing_gm',
            });

            issues.push({
              issueKey,
              issueType,
              severity,
              periodStart: periodStartStr,
              periodEnd: periodEndStr,
              clientId,
              clientName: client.clientName,
              consultantId: null,
              consultantName: null,
              role: 'Trailing GM',
              trailingGMPct,
              expectedGMPct,
              trailingGMVariancePct: gmVariancePct,
              trailingRevenue,
              trailingGM,
            });
          }
        }
      }
    }

    // Attach saved notes
    const issueKeys = issues.map(i => i.issueKey);
    const notes = await ReportIssueNote.getByKeys(issueKeys);
    const notesByKey = new Map(notes.map(n => [n.IssueKey, n]));

    for (const issue of issues) {
      const n = notesByKey.get(issue.issueKey);
      issue.note = n ? {
        status: n.Status,
        decision: n.Decision,
        snoozedUntil: n.SnoozedUntil ? toDateStr(n.SnoozedUntil) : null,
        notes: n.Notes ?? null,
        acknowledgedAt: n.AcknowledgedAt ?? null,
        acknowledgedBy: n.AcknowledgedBy ?? null,
      } : null;
    }

    // Hide snoozed issues (until snooze date passes)
    const filteredIssues = issues.filter(i => {
      const snooze = i.note?.snoozedUntil;
      if (!snooze) return true;
      return dayjs(snooze).isBefore(today, 'day');
    });

    // Calculate trailing 3-month GM for clients (optimized - only if needed)
    // This is done asynchronously and added to issues if variance exceeds threshold

    return {
      meta: {
        startDate: periodStartStr,
        endDate: periodEndStr,
        asOfDate: asOf.format('YYYY-MM-DD'),
        includeSubmitted,
        businessDaysOnly,
      },
      settings: {
        warnPct,
        critPct,
      },
      holidayCalendar: holidays,
      summary: {
        ...summarySums,
        benchHoursToDate: benchTotals.benchHoursToDate,
        benchCostToDate: benchTotals.benchCostToDate,
        benchHoursPeriod: benchTotals.benchHoursPeriod,
        benchCostPeriod: benchTotals.benchCostPeriod,
        // Software revenue and cost breakdown
        softwareRevenuePeriod,
        softwareRevenueToDate,
        softwareCostPeriod,
        softwareCostToDate,
        softwareGMPeriod: softwareRevenuePeriod - softwareCostPeriod,
        softwareGMToDate: softwareRevenueToDate - softwareCostToDate,
        // Service revenue and cost (excluding software)
        serviceRevenuePeriod,
        serviceRevenueToDate,
        serviceCostPeriod,
        serviceCostToDate,
        serviceGMPeriod: serviceRevenuePeriod - serviceCostPeriod,
        serviceGMToDate: serviceRevenueToDate - serviceCostToDate,
      },
      assignmentRows,
      byClient,
      byConsultant,
      byRole,
      trend,
      issues: filteredIssues,
    };
  }

  /**
   * Get capacity planning for next month
   * Projects utilization based on active benchmarks and contract end dates
   */
  static async getCapacityPlanning({ asOfDate }) {
    const asOf = parseDateInput(asOfDate);
    if (!asOf) throw new Error('Invalid asOfDate (expected YYYY-MM-DD)');

    const nextMonthStart = asOf.add(1, 'month').startOf('month');
    const nextMonthEnd = nextMonthStart.endOf('month');
    const nextMonthStartStr = nextMonthStart.format('YYYY-MM-DD');
    const nextMonthEndStr = nextMonthEnd.format('YYYY-MM-DD');

    const pool = await poolPromise;

    // Get consultants (get all - Consultant table may not have Status column)
    const consultantsResult = await pool.request().query(`
      SELECT ConsultantID, FirstName, LastName, CapacityHoursPerWeek, PayType, PayRate, HourlyRate
      FROM Consultant
    `);
    const consultants = consultantsResult.recordset ?? [];

    // Get active contracts with end dates (optimized - only get contracts that might end next month or are active)
    const contractsResult = await pool.request()
      .input('NextMonthStart', sql.Date, nextMonthStartStr)
      .input('NextMonthEnd', sql.Date, nextMonthEndStr)
      .query(`
        SELECT 
          ContractID,
          ClientID,
          ContractType,
          ContractStartDate,
          ContractEndDate,
          AssignedCFO,
          AssignedController,
          AssignedSeniorAccountant,
          AdditionalStaff
        FROM Contract
        WHERE ContractEndReason IS NULL
          AND ContractStartDate <= @NextMonthEnd
          AND (ContractEndDate IS NULL OR ContractEndDate >= @NextMonthStart)
      `);
    const contracts = contractsResult.recordset ?? [];

    // Get clients
    const clientsResult = await pool.request().query(`
      SELECT ClientID, ClientName, ActiveStatus
      FROM Client
    `);
    const clients = clientsResult.recordset ?? [];
    const clientNameById = new Map(clients.map(c => [normalizeId(c.ClientID), c.ClientName]));
    // Convert ActiveStatus to status string (same as main report)
    const clientStatusById = new Map(clients.map(c => [normalizeId(c.ClientID), (c.ActiveStatus === 1 || c.ActiveStatus === true || c.ActiveStatus === '1' ? 'Active' : 'Inactive')]));

    // Get active benchmarks for next month (optimized query with better date filtering)
    // Benchmarks don't have ActiveStatus - filter by EffectiveDate instead
    const benchmarksResult = await pool.request()
      .input('NextMonthStart', sql.Date, nextMonthStartStr)
      .input('NextMonthEnd', sql.Date, nextMonthEndStr)
      .query(`
        SELECT 
          BenchmarkID,
          ClientID,
          ConsultantID,
          Role,
          TargetHours,
          DistributionType,
          EffectiveDate
        FROM Benchmark
        WHERE EffectiveDate <= @NextMonthEnd
        ORDER BY ConsultantID, ClientID
      `);
    const benchmarks = benchmarksResult.recordset ?? [];

    // Get holidays
    const holidaysResult = await pool.request()
      .input('StartDate', sql.Date, nextMonthStartStr)
      .input('EndDate', sql.Date, nextMonthEndStr)
      .query(`
        SELECT HolidayDate, HolidayName
        FROM HolidayCalendar
        WHERE HolidayDate BETWEEN @StartDate AND @EndDate
      `);
    const holidays = holidaysResult.recordset ?? [];
    const holidaySet = new Set(holidays.map(h => toDateStr(parseDateInput(h.HolidayDate))));

    // Calculate business days ONCE (reused for all consultants)
    const businessDays = enumerateDays(nextMonthStart, nextMonthEnd).filter(d => 
      isWorkingDay(d, true, holidaySet)
    );
    const totalBusinessDays = businessDays.length;

    // Build contract lookup map for faster matching: clientId|consultantId -> contract
    const contractMap = new Map();
    for (const contract of contracts) {
      const cClientId = normalizeId(contract.ClientID);
      const cfoId = normalizeId(contract.AssignedCFO);
      const controllerId = normalizeId(contract.AssignedController);
      const saId = normalizeId(contract.AssignedSeniorAccountant);
      
      if (cfoId) {
        const key = `${cClientId}|${cfoId}`;
        if (!contractMap.has(key)) contractMap.set(key, contract);
      }
      if (controllerId) {
        const key = `${cClientId}|${controllerId}`;
        if (!contractMap.has(key)) contractMap.set(key, contract);
      }
      if (saId) {
        const key = `${cClientId}|${saId}`;
        if (!contractMap.has(key)) contractMap.set(key, contract);
      }
    }

    // Group benchmarks by consultant upfront (O(n) instead of O(n*m) filtering)
    const benchmarksByConsultant = new Map();
    for (const bench of benchmarks) {
      const consultantId = normalizeId(bench.ConsultantID);
      const arr = benchmarksByConsultant.get(consultantId) ?? [];
      arr.push(bench);
      benchmarksByConsultant.set(consultantId, arr);
    }

    // Calculate capacity and projected utilization for each consultant
    const capacityPlanning = [];
    const contractsEndingNextMonth = [];
    const contractsEndingSet = new Set(); // Track duplicates

    for (const consultant of consultants) {
      const consultantId = normalizeId(consultant.ConsultantID);
      const consultantName = `${consultant.FirstName ?? ''} ${consultant.LastName ?? ''}`.trim();
      const capacityWeek = safeNum(consultant.CapacityHoursPerWeek) || 40;
      const hoursPerDay = capacityWeek / 5;

      // Calculate next month capacity (using pre-calculated business days)
      const capacityHours = totalBusinessDays * hoursPerDay;

      // Get benchmarks for this consultant (using pre-grouped map)
      const consultantBenchmarks = benchmarksByConsultant.get(consultantId) ?? [];

      // Calculate projected hours from benchmarks
      let projectedHours = 0;
      const assignments = [];

      for (const bench of consultantBenchmarks) {
        const clientId = normalizeId(bench.ClientID);
        const clientName = clientNameById.get(clientId) ?? '(Unknown Client)';
        const role = bench.Role ?? '(Unspecified Role)';
        const targetHours = safeNum(bench.TargetHours) || 0;
        const distributionType = (bench.DistributionType ?? 'linear').toString().toLowerCase();

        // Check if contract is ending next month (using lookup map for O(1) access)
        const contractKey = `${clientId}|${consultantId}`;
        const contract = contractMap.get(contractKey);

        let contractEnding = null;
        if (contract && contract.ContractEndDate) {
          const endDate = parseDateInput(contract.ContractEndDate);
          if (endDate && endDate.isSameOrBefore(nextMonthEnd, 'day') && endDate.isSameOrAfter(nextMonthStart, 'day')) {
            contractEnding = endDate.format('YYYY-MM-DD');
            // Avoid duplicates using Set for O(1) lookup
            const duplicateKey = `${contract.ContractID}|${consultantId}`;
            if (!contractsEndingSet.has(duplicateKey)) {
              contractsEndingSet.add(duplicateKey);
              contractsEndingNextMonth.push({
                contractId: contract.ContractID,
                clientId,
                clientName,
                consultantId,
                consultantName,
                contractEndDate: contractEnding,
                contractType: contract.ContractType,
              });
            }
          }
        }

        // Calculate projected hours using distribution
        // Simplified: use linear distribution for capacity planning (faster)
        // For more accurate distribution, we'd need to call getPerformanceReport which is expensive
        const monthHours = totalBusinessDays > 0 ? targetHours : 0;

        projectedHours += monthHours;
        assignments.push({
          clientId,
          clientName,
          role,
          projectedHours: monthHours,
          contractEnding,
        });
      }

      const utilization = capacityHours > 0 ? (projectedHours / capacityHours) : 0;
      const availableCapacity = Math.max(0, capacityHours - projectedHours);

      capacityPlanning.push({
        consultantId,
        consultantName,
        capacityHours,
        projectedHours,
        utilization,
        availableCapacity,
        assignments,
      });
    }

    // Sort capacity planning by consultant name
    capacityPlanning.sort((a, b) => {
      const nameA = (a.consultantName || '').toLowerCase();
      const nameB = (b.consultantName || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    // Sort contracts ending next month by date
    contractsEndingNextMonth.sort((a, b) => {
      const dateA = dayjs(a.contractEndDate);
      const dateB = dayjs(b.contractEndDate);
      return dateA.valueOf() - dateB.valueOf();
    });

    return {
      meta: {
        nextMonthStart: nextMonthStartStr,
        nextMonthEnd: nextMonthEndStr,
        asOfDate: asOf.format('YYYY-MM-DD'),
      },
      capacityPlanning,
      contractsEndingNextMonth,
    };
  }

  static async getWeeklyIssues({
    weekStart,
    weekEnd,
    clientIds = [],
    consultantIds = [],
    role = null,
    includeSubmitted = false,
    businessDaysOnly = true,
    lookbackWeeks = 4, // Reduced from 8 to 4 for better performance
  }) {
    const start = parseDateInput(weekStart);
    const end = parseDateInput(weekEnd);
    if (!start || !end) throw new Error('Invalid weekStart/weekEnd (expected YYYY-MM-DD)');
    if (end.isBefore(start, 'day')) throw new Error('weekEnd must be on or after weekStart');

    console.log('getWeeklyIssues - Starting, lookbackWeeks:', lookbackWeeks);
    const startTime = Date.now();

    const report = await this.getPerformanceReport({
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
      asOfDate: end.format('YYYY-MM-DD'),
      clientIds,
      consultantIds,
      role,
      includeSubmitted,
      businessDaysOnly,
    });

    console.log('getWeeklyIssues - Main report loaded in', Date.now() - startTime, 'ms');

    // Count repeats across prior weeks for hours_variance issues
    const repeats = new Map();
    const baseIssues = report.issues.filter(i => i.issueType === 'hours_variance');
    const baseKeyOf = (issue) => `${issue.issueType}|${issue.clientId ?? 'null'}|${issue.consultantId ?? 'null'}|${normalizeRole(issue.role)}`;

    for (const issue of baseIssues) repeats.set(baseKeyOf(issue), 1);

    // Limit lookback to reduce API calls - only check last 4 weeks max
    const maxLookback = Math.min(lookbackWeeks, 4);
    let cursorStart = start.subtract(7, 'day');
    
    // Process lookback weeks in parallel batches to speed up
    const lookbackPromises = [];
    for (let w = 1; w < maxLookback; w++) {
      const cursorEnd = cursorStart.add(6, 'day');
      const weekStartDate = cursorStart.format('YYYY-MM-DD');
      const weekEndDate = cursorEnd.format('YYYY-MM-DD');
      
      lookbackPromises.push(
        this.getPerformanceReport({
          startDate: weekStartDate,
          endDate: weekEndDate,
          asOfDate: weekEndDate,
          clientIds,
          consultantIds,
          includeSubmitted,
          businessDaysOnly,
        }).then(r => {
          const issues = r.issues.filter(i => i.issueType === 'hours_variance');
          return { issues, week: w };
        }).catch(e => {
          console.warn(`getWeeklyIssues - Error loading week ${w}:`, e.message);
          return { issues: [], week: w };
        })
      );
      
      cursorStart = cursorStart.subtract(7, 'day');
    }

    // Wait for all lookback weeks to complete
    const lookbackResults = await Promise.all(lookbackPromises);
    console.log('getWeeklyIssues - Lookback weeks loaded in', Date.now() - startTime, 'ms');

    // Process results
    for (const { issues } of lookbackResults) {
      for (const issue of issues) {
        const bk = baseKeyOf(issue);
        if (repeats.has(bk)) repeats.set(bk, repeats.get(bk) + 1);
      }
    }

    return {
      meta: {
        weekStart: start.format('YYYY-MM-DD'),
        weekEnd: end.format('YYYY-MM-DD'),
        includeSubmitted,
        businessDaysOnly,
        lookbackWeeks,
      },
      issues: report.issues.map(i => ({
        ...i,
        repeatCountLastNWeeks: repeats.get(baseKeyOf(i)) ?? 1,
      })),
    };
  }

    static async getDistinctRoles() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT DISTINCT LTRIM(RTRIM(Role)) AS Role
      FROM Benchmark
      WHERE Role IS NOT NULL AND LTRIM(RTRIM(Role)) <> ''
      ORDER BY LTRIM(RTRIM(Role))
    `);

    const roles = (result.recordset ?? [])
      .map(r => (r.Role ?? '').toString().trim())
      .filter(Boolean);

    // Always include common roles if missing
    const common = ['CFO','Controller','Senior Accountant','Staff Accountant'];
    for (const c of common) {
      if (!roles.some(x => x.toLowerCase() == c.toLowerCase())) roles.push(c);
    }

    return roles.sort((a,b)=> a.localeCompare(b));
  }

  static async getContractsEnding({ asOfDate, daysAhead = 60, clientIds = [] }) {
    const asOf = parseDateInput(asOfDate) ?? dayjs().startOf('day');
    const pool = await poolPromise;

    const clientIdSet = new Set((Array.isArray(clientIds) ? clientIds : []).map(normalizeId).filter(Boolean));

    const result = await pool.request()
      .input('AsOf', sql.Date, asOf.format('YYYY-MM-DD'))
      .input('DaysAhead', sql.Int, Number(daysAhead))
      .query(`
        SELECT 
          c.ContractID,
          c.ClientID,
          cl.ClientName,
          cl.ActiveStatus,
          c.ContractName,
          c.ContractType,
          c.ContractStartDate,
          c.ContractEndDate,
          c.ContractLength,
          c.MonthlyRevenue,
          c.ContractEndReason,
          CASE 
            WHEN c.ContractLength IS NOT NULL AND c.ContractStartDate IS NOT NULL
              THEN DATEADD(month, c.ContractLength, c.ContractStartDate)
            ELSE NULL
          END AS InitialTermEndDate,
          COALESCE(
            c.ContractEndDate,
            CASE 
              WHEN c.ContractLength IS NOT NULL AND c.ContractStartDate IS NOT NULL
                THEN DATEADD(month, c.ContractLength, c.ContractStartDate)
              ELSE NULL
            END
          ) AS EffectiveEndDate
        FROM Contract c
        LEFT JOIN Client cl ON cl.ClientID = c.ClientID
        WHERE c.ContractEndReason IS NULL
          AND (
            (c.ContractEndDate IS NOT NULL AND c.ContractEndDate <= DATEADD(day, @DaysAhead, @AsOf))
            OR (c.ContractEndDate IS NULL AND c.ContractLength IS NOT NULL AND c.ContractStartDate IS NOT NULL 
                AND DATEADD(month, c.ContractLength, c.ContractStartDate) <= DATEADD(day, @DaysAhead, @AsOf))
          )
        ORDER BY EffectiveEndDate ASC
      `);

    let rows = (result.recordset ?? []).map(r => {
      const contractId = normalizeId(r.ContractID);
      const clientId = normalizeId(r.ClientID);
      const clientName = r.ClientName ?? null;
      const clientActiveStatus = r.ActiveStatus ?? null;

      const contractStartDate = r.ContractStartDate ? toDateStr(r.ContractStartDate) : null;
      const contractEndDate = r.ContractEndDate ? toDateStr(r.ContractEndDate) : null;
      const contractLengthMonths = r.ContractLength != null ? Number(r.ContractLength) : null;

      const initialTermEndDate = r.InitialTermEndDate ? toDateStr(r.InitialTermEndDate) : null;
      const effectiveEndDate = r.EffectiveEndDate ? toDateStr(r.EffectiveEndDate) : null;
      const daysUntilEnd = effectiveEndDate ? dayjs(effectiveEndDate).diff(asOf, 'day') : null;

      const isMonthToMonth = (!contractEndDate && initialTermEndDate)
        ? dayjs(asOf).isAfter(dayjs(initialTermEndDate), 'day')
        : false;

      return {
        contractId,
        clientId,
        clientName,
        clientActiveStatus,
        contractName: r.ContractName ?? null,
        contractType: r.ContractType ?? null,
        contractStartDate,
        contractEndDate,
        contractLengthMonths,
        initialTermEndDate,
        effectiveEndDate,
        monthlyRevenue: r.MonthlyRevenue != null ? Number(r.MonthlyRevenue) : null,
        contractEndReason: r.ContractEndReason ?? null,
        isMonthToMonth,
        daysUntilEnd,
      };
    });

    if (clientIdSet.size) rows = rows.filter(r => clientIdSet.has(r.clientId));

    return rows;
  }
}

export default PerformanceReport;
