// Placeholder integration for DocuSign
export async function sendEnvelope({ accessToken, templateId, recipient, fields }) {
  console.warn("DocuSign sendEnvelope not wired. Mock no-op.");
  return { envelopeId: "env_mock_123", status: "sent" };
}
export async function watchEnvelope({ accessToken, envelopeId }) {
  console.warn("DocuSign watchEnvelope not wired. Mock no-op.");
  return { status: "completed" };
}