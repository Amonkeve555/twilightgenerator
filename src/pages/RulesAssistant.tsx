import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Bot, User, Loader2, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StarField from "@/components/StarField";
import { toast } from "sonner";

type Citation = {
  n: number;
  label: string;
  page_start: number | null;
  page_end: number | null;
  excerpt: string;
};

type Msg = { role: "user" | "assistant"; content: string; citations?: Citation[] };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rules-chat`;

const QUICK_QUESTIONS = [
  "How does Space Combat work?",
  "Explain the Agenda Phase",
  "How does planetary invasion work?",
  "What are action cards?",
  "How does the strategy phase work?",
  "Explain tactical actions step by step",
];

async function streamChat({
  messages,
  onDelta,
  onCitations,
  onDone,
}: {
  messages: Msg[];
  onDelta: (deltaText: string) => void;
  onCitations: (cs: Citation[]) => void;
  onDone: () => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (resp.status === 429) {
    toast.error("Rate limit reached. Please try again in a moment.");
    onDone();
    return;
  }
  if (resp.status === 402) {
    toast.error("AI credits exhausted. Please add funds in Settings.");
    onDone();
    return;
  }
  if (!resp.ok || !resp.body) throw new Error("Failed to start stream");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;
  let pendingEvent: string | null = null;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.trim() === "") { pendingEvent = null; continue; }
      if (line.startsWith(":")) continue;
      if (line.startsWith("event: ")) {
        pendingEvent = line.slice(7).trim();
        continue;
      }
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        if (pendingEvent === "citations") {
          if (Array.isArray(parsed.citations)) onCitations(parsed.citations);
        } else {
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        }
        pendingEvent = null;
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  if (textBuffer.trim()) {

    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        /* ignore */
      }
    }
  }

  onDone();
}

const RulesAssistant = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    const attachCitations = (cs: Citation[]) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, citations: cs } : m));
        }
        return prev;
      });
    };

    try {
      await streamChat({
        messages: [...messages, userMsg],
        onDelta: (chunk) => upsertAssistant(chunk),
        onCitations: attachCitations,
        onDone: () => setIsLoading(false),
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to get a response. Please try again.");
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col">
      <StarField />
      <div className="relative z-10 flex flex-col flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-4">
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-[0.15em] text-primary text-glow mb-2">
            Rules Assistant
          </h1>
          <p className="font-display text-sm uppercase tracking-[0.3em] text-muted-foreground">
            AI-Powered TI4 Rules Help
          </p>
          <div className="imperial-divider w-48 mx-auto mt-3" />
        </motion.div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0" style={{ maxHeight: "calc(100vh - 320px)" }}>
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 text-primary/40 mx-auto mb-4" />
              <p className="text-muted-foreground font-body text-base mb-6">
                Ask me anything about Twilight Imperium rules!
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="glass imperial-border rounded p-3 text-left text-sm font-body text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-sm bg-primary/20 flex items-center justify-center mt-1">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded p-3 ${
                  msg.role === "user"
                    ? "bg-primary/20 border border-primary/30 text-foreground"
                    : "glass imperial-border text-foreground"
                }`}
              >
                {msg.role === "assistant" ? (
                  <>
                    <div className="prose prose-sm prose-invert max-w-none font-body text-sm [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-1 [&_h1]:text-primary [&_h2]:text-primary [&_h3]:text-primary [&_strong]:text-primary [&_code]:bg-primary/10 [&_code]:text-primary [&_code]:px-1 [&_code]:rounded">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="font-display text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5 flex items-center gap-1">
                          <BookOpen className="h-3 w-3" /> Sources
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.citations.map((c) => {
                            const pg = c.page_start
                              ? c.page_end && c.page_end !== c.page_start
                                ? `pp. ${c.page_start}–${c.page_end}`
                                : `p. ${c.page_start}`
                              : "";
                            return (
                              <button
                                key={c.n}
                                onClick={() => setActiveCitation(c)}
                                className="text-[11px] font-body px-2 py-0.5 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition cursor-pointer"
                              >
                                [{c.n}] {c.label}{pg ? `, ${pg}` : ""}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="font-body text-sm">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-sm bg-muted flex items-center justify-center mt-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-sm bg-primary/20 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="glass imperial-border rounded p-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="glass imperial-border rounded p-3 flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about TI4 rules..."
            className="min-h-[44px] max-h-32 resize-none bg-transparent border-0 focus-visible:ring-0 font-body text-base p-0"
            rows={1}
          />
          <Button
            onClick={() => send(input)}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-center mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/")}
            className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40"
          >
            <ArrowLeft className="mr-2 h-3 w-3" />
            Back to Home
          </Button>
        </div>
      </div>

      <Dialog open={!!activeCitation} onOpenChange={(o) => !o && setActiveCitation(null)}>
        <DialogContent className="glass imperial-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-base uppercase tracking-[0.15em] text-primary">
              {activeCitation && (
                <>
                  [{activeCitation.n}] {activeCitation.label}
                  {activeCitation.page_start && (
                    <span className="text-muted-foreground text-sm ml-2 normal-case tracking-normal">
                      {activeCitation.page_end && activeCitation.page_end !== activeCitation.page_start
                        ? `pp. ${activeCitation.page_start}–${activeCitation.page_end}`
                        : `p. ${activeCitation.page_start}`}
                    </span>
                  )}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <p className="font-body text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {activeCitation?.excerpt}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RulesAssistant;
