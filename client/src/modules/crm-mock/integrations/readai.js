// Placeholder integration for Read.ai
export async function fetchMeetingSummaries({ apiKey, since }) {
  console.warn("Read.ai fetch summaries not wired. Mock.");
  return [{ id: "read1", title: "Discovery — Blue Harbor Foods", actions: ["Send pricing", "Share calendar link"] }];
}