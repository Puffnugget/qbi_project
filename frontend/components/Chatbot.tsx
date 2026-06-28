"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { API_BASE } from "@/lib/constants";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-fg">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

function MessageContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    elements.push(
      <ul key={`ul-${elements.length}`} className="my-1.5 ml-3 list-disc space-y-0.5">
        {listItems.map((item, j) => (
          <li key={j}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <p key={elements.length} className="mt-2 mb-1 font-semibold text-fg">
          {renderInline(trimmed.slice(4))}
        </p>,
      );
    } else if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <p key={elements.length} className="mt-2 mb-1 font-semibold text-fg">
          {renderInline(trimmed.slice(3))}
        </p>,
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listItems.push(trimmed.slice(2));
    } else {
      flushList();
      elements.push(
        <p key={elements.length} className="my-0.5">
          {renderInline(trimmed)}
        </p>,
      );
    }
  }

  flushList();
  return <>{elements}</>;
}

interface ChatbotProps {
  systemPrompt?: string;
}

function parseSSEContent(chunk: string): string {
  let result = "";
  for (const line of chunk.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (payload === "[DONE]") continue;
    try {
      const json = JSON.parse(payload);
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) result += delta;
    } catch {
      // ignore malformed chunks
    }
  }
  return result;
}

export default function Chatbot({ systemPrompt }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    const userMessage: Message = { role: "user", content: trimmed };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput("");
    setError(null);
    setStreaming(true);

    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages([...next, assistantMessage]);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          systemPrompt,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? res.statusText);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const newText = parseSSEContent(buffer);
        if (newText) {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: updated[updated.length - 1].content + newText,
            };
            return updated;
          });
          buffer = "";
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-accent/15 text-accent text-xs font-bold">T</span>
          <p className="text-xs font-semibold text-fg">Tina agent</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-fg-subtle text-center leading-relaxed max-w-[14rem]">
              Ask the Tina agent about this tumor, screening results, or policy comparison.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div
              className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold mt-0.5 ${
                msg.role === "user"
                  ? "bg-surface-elevated text-fg-muted border border-border"
                  : "bg-accent/15 text-accent"
              }`}
            >
              {msg.role === "user" ? "U" : "T"}
            </div>
            <div
              className={`max-w-[82%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-surface-elevated text-fg border border-border rounded-tr-sm"
                  : "bg-canvas text-fg-muted border border-border/40 rounded-tl-sm"
              }`}
            >
              {msg.content ? (
                msg.role === "assistant" ? (
                  <MessageContent content={msg.content} />
                ) : (
                  msg.content
                )
              ) : (
                <span className="inline-flex gap-1 items-center py-0.5">
                  <span className="size-1 rounded-full bg-accent/50 animate-bounce [animation-delay:0ms]" />
                  <span className="size-1 rounded-full bg-accent/50 animate-bounce [animation-delay:150ms]" />
                  <span className="size-1 rounded-full bg-accent/50 animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </div>
          </div>
        ))}

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-border/30 px-3 py-3"
      >
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the Tina agent…"
            rows={1}
            disabled={streaming}
            className="input-base min-h-[2rem] flex-1 resize-none px-2.5 py-2 text-xs leading-relaxed disabled:opacity-60"
            style={{ maxHeight: "6rem", overflowY: "auto" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="btn-primary shrink-0 px-3 py-2 text-xs disabled:opacity-40"
          >
            {streaming ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
