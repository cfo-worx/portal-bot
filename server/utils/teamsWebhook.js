import axios from "axios";

/**
 * Send a simple Teams message via Incoming Webhook URL.
 * If webhookUrl is missing, this is a no-op (returns { skipped: true }).
 */
export async function sendTeamsWebhookMessage({ webhookUrl, title, text, facts = [] }) {
  if (!webhookUrl) return { skipped: true };

  const payload = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: title || "CFO Worx Portal",
    themeColor: "0076D7",
    title: title || "CFO Worx Portal",
    text: text || "",
    sections: facts.length
      ? [
          {
            facts: facts.map((f) => ({ name: String(f.name), value: String(f.value) })),
            markdown: true,
          },
        ]
      : undefined,
  };

  const res = await axios.post(webhookUrl, payload, { timeout: 10000 });
  return { ok: true, status: res.status };
}

