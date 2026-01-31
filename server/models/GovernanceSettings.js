import { poolPromise } from "../db.js";
import sql from "mssql";

export async function getGovernanceSettings() {
  const pool = await poolPromise;
  const res = await pool.request().query(`
    SELECT TOP 1 SettingsID, DefaultComplianceLeadDays, DefaultInsuranceLeadDays, DefaultVendorLeadDays,
           DigestEnabled, DigestCron, Timezone, TeamsWebhookUrl
    FROM dbo.GovernanceSettings
    ORDER BY SettingsID ASC
  `);
  return res.recordset[0] || null;
}

export async function updateGovernanceSettings(patch) {
  const pool = await poolPromise;
  // Update singleton row (SettingsID=1 is safest; but use TOP 1)
  const current = await getGovernanceSettings();
  if (!current) throw new Error("GovernanceSettings row not found. Run migrations.");

  const merged = { ...current, ...patch, UpdatedAt: new Date() };

  const req = pool.request()
    .input("SettingsID", sql.Int, current.SettingsID)
    .input("DefaultComplianceLeadDays", sql.Int, merged.DefaultComplianceLeadDays)
    .input("DefaultInsuranceLeadDays", sql.Int, merged.DefaultInsuranceLeadDays)
    .input("DefaultVendorLeadDays", sql.Int, merged.DefaultVendorLeadDays)
    .input("DigestEnabled", sql.Bit, merged.DigestEnabled ? 1 : 0)
    .input("DigestCron", sql.NVarChar(50), merged.DigestCron)
    .input("Timezone", sql.NVarChar(100), merged.Timezone)
    .input("TeamsWebhookUrl", sql.NVarChar(400), merged.TeamsWebhookUrl ?? null);

  await req.query(`
    UPDATE dbo.GovernanceSettings
    SET DefaultComplianceLeadDays=@DefaultComplianceLeadDays,
        DefaultInsuranceLeadDays=@DefaultInsuranceLeadDays,
        DefaultVendorLeadDays=@DefaultVendorLeadDays,
        DigestEnabled=@DigestEnabled,
        DigestCron=@DigestCron,
        Timezone=@Timezone,
        TeamsWebhookUrl=@TeamsWebhookUrl,
        UpdatedAt=SYSUTCDATETIME()
    WHERE SettingsID=@SettingsID
  `);

  return await getGovernanceSettings();
}

