import { NextRequest } from "next/server";

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_API_KEY = "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";
const MODEL = "google/diffusiongemma-26b-a4b-it";

export async function POST(req: NextRequest) {
  const { messages, systemPrompt } = await req.json();

  const apiMessages = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const upstream = await fetch(NVIDIA_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: apiMessages,
      max_tokens: 4096,
      temperature: 1.0,
      top_p: 0.95,
      stream: true,
      chat_template_kwargs: { enable_thinking: true },
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(JSON.stringify({ error: text }), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
