import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Bot, ChevronDown, Plus, Send, Sparkles, Trash2, X,
  CircleCheck, LoaderCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: number;
  title: string;
  model: string;
}

// ─── Models ──────────────────────────────────────────────────────────────────
const MODELS = [
  {
    id: "openai/gpt-4o-2024-11-20",
    label: "ChatGPT",
    short: "GPT-4o",
    color: "bg-emerald-500",
    description: "OpenAI — paling pintar, kontext panjang",
  },
  {
    id: "deepseek/deepseek-chat-v3-0324",
    label: "DeepSeek",
    short: "DeepSeek V3",
    color: "bg-blue-500",
    description: "DeepSeek — cepat & efisien, reasoning kuat",
  },
  {
    id: "google/gemini-3.6-flash",
    label: "Gemini",
    short: "Gemini Flash",
    color: "bg-violet-500",
    description: "Google — multimodal, respons cepat",
  },
  {
    id: "qwen/qwen3.6-flash",
    label: "Qwen",
    short: "Qwen 3.6",
    color: "bg-orange-500",
    description: "Alibaba — unggul di bahasa Asia",
  },
] as const;

// ─── Quick prompts ────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  "Cara membaca data tender di platform ini?",
  "Apa itu SKK jenjang 7, 8, 9?",
  "Bagaimana cara menggunakan Pain Points?",
  "Jelaskan Master Knowledge Registry (MKR)",
  "Fitur apa saja yang ada di platform ini?",
  "Cara export data ke Excel?",
];

// ─── API helpers ──────────────────────────────────────────────────────────────
const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

async function createConversation(title: string, model: string): Promise<Conversation> {
  const r = await fetch(`${API}/openrouter/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, model }),
  });
  return r.json();
}

async function deleteConversation(id: number): Promise<void> {
  await fetch(`${API}/openrouter/conversations/${id}`, { method: "DELETE" });
}

// ─── Markdown renderer (lightweight) ─────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      elements.push(<br key={key++} />);
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(<p key={key++} className="font-bold text-sm mt-2 mb-0.5">{line.slice(3)}</p>);
    } else if (line.startsWith("# ")) {
      elements.push(<p key={key++} className="font-black text-sm mt-2 mb-0.5">{line.slice(2)}</p>);
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      elements.push(
        <div key={key++} className="flex gap-1.5 items-start">
          <span className="text-primary mt-0.5 shrink-0">•</span>
          <span>{line.slice(2)}</span>
        </div>
      );
    } else if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\. /)?.[1];
      elements.push(
        <div key={key++} className="flex gap-1.5 items-start">
          <span className="text-primary font-mono text-xs shrink-0 mt-0.5">{num}.</span>
          <span>{line.replace(/^\d+\. /, "")}</span>
        </div>
      );
    } else if (line.startsWith("**") && line.endsWith("**")) {
      elements.push(<p key={key++} className="font-bold">{line.slice(2, -2)}</p>);
    } else {
      // Inline bold
      const parts = line.split(/\*\*(.*?)\*\*/g);
      elements.push(
        <p key={key++}>
          {parts.map((part, pi) =>
            pi % 2 === 1 ? <strong key={pi}>{part}</strong> : part
          )}
        </p>
      );
    }
  }
  return <>{elements}</>;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FloatingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<typeof MODELS[number]>(MODELS[0]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const startNewChat = useCallback(async (modelOverride?: typeof MODELS[number]) => {
    const model = modelOverride || selectedModel;
    const conv = await createConversation(
      `Chat ${new Date().toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}`,
      model.id
    );
    setConversation(conv);
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: `Halo! Saya **INTEL-AI** menggunakan **${model.label} (${model.short})**.\n\nSaya siap membantu kamu memahami data riset konstruksi dan menggunakan platform ini. Ada yang bisa saya bantu?`,
    }]);
    setInput("");
  }, [selectedModel]);

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;

    let conv = conversation;
    if (!conv) {
      conv = await createConversation(
        content.slice(0, 40),
        selectedModel.id
      );
      setConversation(conv);
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: `Halo! Saya **INTEL-AI** menggunakan **${selectedModel.label}**. Membaca pertanyaanmu...`,
      }]);
    }

    const userMsg: Message = { id: Date.now().toString(), role: "user", content };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    abortRef.current = new AbortController();

    try {
      const response = await fetch(
        `${API}/openrouter/conversations/${conv.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, model: selectedModel.id }),
          signal: abortRef.current.signal,
        }
      );

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));
          if (data.error) {
            setMessages(prev =>
              prev.map(m => m.id === assistantId ? { ...m, content: data.error } : m)
            );
          } else if (data.content) {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content + data.content } : m
              )
            );
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: "Maaf, terjadi kesalahan. Coba lagi." }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, conversation, selectedModel]);

  const clearChat = useCallback(async () => {
    if (conversation) {
      await deleteConversation(conversation.id);
    }
    setConversation(null);
    setMessages([]);
    setInput("");
  }, [conversation]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleModelSelect = async (model: typeof MODELS[number]) => {
    setSelectedModel(model);
    setShowModelPicker(false);
    if (messages.length > 0) {
      // New chat with new model
      if (conversation) await deleteConversation(conversation.id);
      setConversation(null);
      setMessages([{
        id: "model-switch",
        role: "assistant",
        content: `Model diganti ke **${model.label} (${model.short})**. Chat baru dimulai!`,
      }]);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full shadow-xl transition-all duration-300",
          "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95",
          isOpen
            ? "px-4 py-2.5 text-sm font-semibold"
            : "px-4 py-3 text-sm font-bold"
        )}
      >
        {isOpen ? (
          <><X className="h-4 w-4" /><span>Tutup</span></>
        ) : (
          <>
            <Sparkles className="h-4 w-4 animate-pulse" />
            <span>INTEL-AI</span>
            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          </>
        )}
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          "fixed bottom-20 right-6 z-50 flex flex-col rounded-2xl border bg-background shadow-2xl",
          "transition-all duration-300 origin-bottom-right",
          isOpen
            ? "w-[380px] h-[580px] opacity-100 scale-100"
            : "w-0 h-0 opacity-0 scale-90 pointer-events-none overflow-hidden"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Bot className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-sm leading-none">INTEL-AI</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                Asisten Riset Marketing Konstruksi
              </p>
            </div>
          </div>

          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(p => !p)}
              className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold hover:bg-muted/80 transition-colors"
            >
              <span className={cn("h-2 w-2 rounded-full", selectedModel.color)} />
              {selectedModel.short}
              <ChevronDown className="h-3 w-3" />
            </button>

            {showModelPicker && (
              <div className="absolute right-0 top-8 z-10 w-64 rounded-xl border bg-background shadow-xl p-1.5">
                <p className="text-[10px] font-bold text-muted-foreground px-2 py-1 uppercase tracking-wide">
                  Pilih Model AI
                </p>
                {MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleModelSelect(m)}
                    className={cn(
                      "w-full text-left rounded-lg px-3 py-2 hover:bg-muted transition-colors",
                      m.id === selectedModel.id && "bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", m.color)} />
                      <span className="font-semibold text-sm">{m.label}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{m.short}</span>
                      {m.id === selectedModel.id && (
                        <CircleCheck className="h-3.5 w-3.5 text-primary" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 pl-4">
                      {m.description}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <button
            onClick={clearChat}
            title="Chat baru"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              title="Hapus chat"
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col gap-3 h-full justify-center">
              <div className="text-center">
                <Sparkles className="h-10 w-10 mx-auto text-primary/40 mb-2" />
                <p className="font-bold text-sm">Tanya INTEL-AI</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Panduan fitur, cara baca data, atau insight riset konstruksi
                </p>
              </div>
              <div className="grid gap-1.5">
                {QUICK_PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border hover:bg-muted hover:border-primary/30 transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  )}
                >
                  {msg.role === "assistant" ? (
                    msg.content ? renderMarkdown(msg.content) : (
                      <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
                    )
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="border-t p-3 shrink-0">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tanya tentang data atau fitur platform..."
              className="min-h-[40px] max-h-[100px] resize-none text-xs rounded-xl"
              rows={1}
              disabled={isStreaming}
            />
            <Button
              size="icon"
              className="h-9 w-9 rounded-xl shrink-0"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[9px] text-muted-foreground text-center mt-1.5">
            {selectedModel.label} · Enter kirim · Shift+Enter baris baru
          </p>
        </div>
      </div>

      {/* Click-outside to close model picker */}
      {showModelPicker && (
        <div className="fixed inset-0 z-40" onClick={() => setShowModelPicker(false)} />
      )}
    </>
  );
}
