"use client";

import { TypographyH2, TypographyP } from "@/components/ui/typography";
import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

interface ChatMsg {
  role: "user" | "bot";
  content: string;
}

export default function SpeciesChatbot() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  const handleSubmit = async () => {
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setChatLog((prev) => [...prev, { role: "user", content: text }]);
    setMessage("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = (await res.json()) as { response?: string; error?: string };
      const bot = data.response ?? data.error ?? "Sorry—my provider returned an error. Please try again.";
      setChatLog((prev) => [...prev, { role: "bot", content: bot }]);
    } catch {
      setChatLog((prev) => [...prev, { role: "bot", content: "Network error. Please try again." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TypographyH2>Species Chatbot</TypographyH2>
      <div className="mt-4 flex gap-4">
        <div className="mt-4 rounded-lg bg-foreground p-4 text-background">
          <TypographyP>
            The Species Chatbot is specialized to answer questions about animals. Ask about habitat, diet, conservation
            status, and other details. Unrelated prompts will get a reminder that it’s species-only.
          </TypographyP>
          <TypographyP>Type your question below and press Enter.</TypographyP>
        </div>
      </div>
      <div className="mx-auto mt-6">
        <div className="h-[400px] space-y-3 overflow-y-auto rounded-lg border border-border bg-muted p-4">
          {chatLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">Start chatting about a species!</p>
          ) : (
            chatLog.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] whitespace-pre-wrap rounded-2xl p-3 text-sm ${
                    msg.role === "user"
                      ? "rounded-br-none bg-primary text-primary-foreground"
                      : "rounded-bl-none border border-border bg-foreground text-primary-foreground"
                  }`}
                >
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex flex-col items-end">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onInput={handleInput}
            rows={1}
            placeholder="Ask about a species..."
            className="w-full resize-none overflow-hidden rounded border border-border bg-background p-2 text-sm text-foreground focus:outline-none"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            className="mt-2 rounded bg-primary px-4 py-2 text-background transition hover:opacity-90 disabled:opacity-50"
            disabled={busy}
          >
            {busy ? "Thinking..." : "Enter"}
          </button>
        </div>
      </div>
    </>
  );
}
