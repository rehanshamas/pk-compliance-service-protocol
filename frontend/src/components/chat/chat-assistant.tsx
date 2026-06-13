"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { MessageCircle, X, Send, Bot, User, ExternalLink, Loader2 } from "lucide-react";
import { searchKnowledge, type KBEntry } from "@/lib/chat-knowledge";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  links?: { label: string; href: string }[];
  timestamp: Date;
}

const SUGGESTIONS = [
  "How do I get started?",
  "How do I create a customer?",
  "How does screening work?",
  "How do I file an STR?",
  "How do I check a wallet?",
  "What is EDD?",
];

export function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if chat is enabled
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/chat-config`)
      .then((r) => r.json())
      .then((data) => {
        setEnabled(data.enabled);
        setWelcomeMessage(data.welcomeMessage || "Hi! I'm your CIP assistant. Ask me anything about the platform.");
      })
      .catch(() => setEnabled(false));
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const addMessage = useCallback((role: "user" | "assistant", content: string, links?: { label: string; href: string }[]) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        role,
        content,
        links,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const handleSend = useCallback((text?: string) => {
    const query = (text || input).trim();
    if (!query) return;

    addMessage("user", query);
    setInput("");
    setTyping(true);

    // Simulate small delay for natural feel
    setTimeout(() => {
      const results = searchKnowledge(query, 2);

      if (results.length > 0 && results[0].score >= 5) {
        // Good match found
        const best = results[0];
        addMessage("assistant", best.answer, best.links);

        // If there's a second relevant result, suggest it
        if (results.length > 1 && results[1].score >= 4) {
          setTimeout(() => {
            addMessage(
              "assistant",
              `You might also want to know: **${results[1].question}**\n\n${results[1].answer.split("\n")[0]}...`,
              results[1].links
            );
          }, 500);
        }
      } else if (results.length > 0) {
        // Partial match
        const best = results[0];
        addMessage(
          "assistant",
          `I found something related:\n\n**${best.question}**\n\n${best.answer}`,
          best.links
        );
      } else {
        // No match
        addMessage(
          "assistant",
          "I'm not sure about that. Here are some things I can help with:\n\n• KYC and customer onboarding\n• Sanctions screening and dispositions\n• Blockchain wallet risk analysis\n• Cases and investigations\n• ISAR and STR filing\n• Monitoring rules\n• Settings and configuration\n\nTry rephrasing your question, or contact support at **support@cip.pk**.",
          [
            { label: "Contact Support", href: "/docs/contact" },
            { label: "FAQ", href: "/docs/faq" },
            { label: "Glossary", href: "/docs/glossary" },
          ]
        );
      }
      setTyping(false);
    }, 300 + Math.random() * 400);
  }, [input, addMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Don't render if disabled or still loading
  if (enabled === null || enabled === false) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-[0_4px_24px_rgba(59,130,246,0.3)] transition-all hover:scale-105 hover:shadow-[0_8px_32px_rgba(59,130,246,0.4)]"
          aria-label="Open chat assistant"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex w-[380px] max-h-[560px] flex-col rounded-[16px] border border-border bg-card shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-[0.82rem] font-semibold">CIP Assistant</div>
                <div className="text-[0.6rem] text-muted-foreground">Ask me anything about CIP</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[280px] max-h-[380px] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-border">
            {messages.length === 0 ? (
              <>
                {/* Welcome */}
                <div className="flex gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                  <div className="rounded-[12px] rounded-tl-[4px] bg-accent px-3 py-2 text-[0.78rem] leading-relaxed max-w-[85%]">
                    {welcomeMessage}
                  </div>
                </div>
                {/* Suggestions */}
                <div className="pl-8 flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="rounded-full border border-border px-2.5 py-1 text-[0.65rem] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                      <Bot className="h-3 w-3 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%] ${msg.role === "user" ? "order-first" : ""}`}>
                    <div
                      className={`rounded-[12px] px-3 py-2 text-[0.78rem] leading-relaxed whitespace-pre-line ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-[4px]"
                          : "bg-accent rounded-tl-[4px]"
                      }`}
                    >
                      {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
                        if (part.startsWith("**") && part.endsWith("**")) {
                          return <strong key={i}>{part.slice(2, -2)}</strong>;
                        }
                        return part;
                      })}
                    </div>
                    {msg.links && msg.links.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5 pl-1">
                        {msg.links.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setOpen(false)}
                            className="inline-flex items-center gap-1 rounded-md bg-primary/5 border border-primary/10 px-2 py-0.5 text-[0.65rem] text-primary hover:bg-primary/10 transition-colors"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                      <User className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))
            )}
            {typing && (
              <div className="flex gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <div className="rounded-[12px] rounded-tl-[4px] bg-accent px-3 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border px-3 py-2.5 shrink-0">
            <div className="flex items-center gap-2 bg-background/50 border border-border rounded-[10px] px-3 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about KYC, screening, analytics…"
                className="flex-1 bg-transparent border-none outline-none text-[0.78rem] text-foreground placeholder:text-muted-foreground/40"
                disabled={typing}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || typing}
                className="flex h-7 w-7 items-center justify-center rounded-md text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-center mt-1.5">
              <span className="text-[0.55rem] text-muted-foreground/40">Powered by CIP Knowledge Base</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
