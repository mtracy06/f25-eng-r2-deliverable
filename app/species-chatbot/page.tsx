"use client";
import type React from "react";
import { TypographyH2, TypographyP } from "@/components/ui/typography";
import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type ChatMsg = { role: "user" | "bot"; content: string };

export default function SpeciesChatbot() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  const handleSubmit = async () => {
    const q = message.trim();
    if (!q || loading) return;

    setChatLog((log) => [...log, { role: "user", content: q }]);
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = data.error ?? "The chatbot had a problem reaching its provider.";
        setChatLog((log) => [...log, { role: "bot", content: msg }]);
        return;
      }

      const data = (await res.json()) as { response: string };
      setChatLog((log) => [...log, { role: "bot", content: data.response }]);
    } catch {
      setChatLog((log) => [
        ...log,
        {
          role: "bot",
          content:
            "Sorry—I couldn’t reach the chat service. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
      handleInput();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <>
      <TypographyH2>Species Chatbot</TypographyH2>
      <div className="mt-4 flex gap-4">
        <div className="mt-4 rounded-lg bg-foreground p-4 text-background">
          <TypographyP>
            Ask about habitats, diets, conservation status, taxonomy, ranges, and other
            animal facts. If you ask something unrelated, I’ll gently steer you back to
            species topics.
          </TypographyP>
        </div>
      </div>

      <div className="mx-auto mt-6">
        {/* Chat history */}
        <div className="h-[400px] space-y-3 overflow-y-auto rounded-lg border border-border bg-muted p-4">
          {chatLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Start chatting about a species!
            </p>
          ) : (
            chatLog.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
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

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-none border border-border bg-foreground p-3 text-sm text-primary-foreground">
                Thinking…
              </div>
            </div>
          )}
        </div>

        {/* Textarea and submission */}
        <div className="mt-4 flex flex-col items-end">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onInput={handleInput}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask about a species..."
            disabled={loading}
            className="w-full resize-none overflow-hidden rounded border border-border bg-background p-2 text-sm text-foreground focus:outline-none disabled:opacity-70"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleSubmit()}
            className="mt-2 rounded bg-primary px-4 py-2 text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Sending..." : "Enter"}
          </button>
        </div>
      </div>
    </>
  );
}
