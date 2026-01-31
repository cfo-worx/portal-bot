// Placeholder integration for ListKit.io
// Replace with real API calls using your backend proxy for secrets.
export async function fetchListKitResponses({ apiKey, since }) {
  console.warn("ListKit API not wired. Returning mock.");
  return [
    { id: "lk1", source: "ListKit", from: "ceo@example.com", preview: "Not interested.", receivedAt: "Today 9:05a" },
  ];
}
export async function sendListKitReply({ apiKey, threadId, body }) {
  console.warn("ListKit send reply not wired. Mock no-op.");
  return { ok: true };
}