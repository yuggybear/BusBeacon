const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ParentChat({ busId, user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!busId) return;
    db.entities.ChatMessage.filter({ bus_id: busId }, "-created_date", 50)
      .then((msgs) => {
        setMessages(msgs.reverse());
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const unsubscribe = db.entities.ChatMessage.subscribe((event) => {
      if (event.type === "create") {
        setMessages((prev) => {
          // Replace optimistic message with the real one when it arrives
          const optimisticIdx = prev.findIndex(
            (m) =>
              m._optimistic &&
              m.message === event.data.message &&
              m.author_name === event.data.author_name
          );
          if (optimisticIdx >= 0) {
            const updated = [...prev];
            updated[optimisticIdx] = event.data;
            return updated;
          }
          // Avoid duplicates
          if (prev.some((m) => m.id === event.data.id)) return prev;
          return [...prev, event.data];
        });
      }
    });
    return unsubscribe;
  }, [busId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");

    // Optimistic update — show message instantly before the DB write resolves
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        message: text,
        author_name: user.full_name || user.email,
        created_by_id: user.id,
        created_date: new Date().toISOString(),
        _optimistic: true,
      },
    ]);

    try {
      await db.entities.ChatMessage.create({
        bus_id: busId,
        author_name: user.full_name || user.email,
        message: text,
      });
    } catch (err) {
      // Roll back the optimistic message on failure and restore the input
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b bg-white shrink-0">
        <h3 className="font-semibold text-sm">Parent Chat</h3>
        <p className="text-xs text-muted-foreground">Chat with other parents on this route</p>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No messages yet. Start the conversation!
          </p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.created_by_id === user.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    isMine ? "bg-blue-600 text-white" : "bg-white border"
                  }`}
                >
                  {!isMine && (
                    <p className="text-xs font-semibold text-blue-600 mb-0.5">
                      {msg.author_name}
                    </p>
                  )}
                  <p className="text-sm">{msg.message}</p>
                  <p
                    className={`text-[10px] mt-0.5 ${
                      isMine ? "text-blue-100" : "text-muted-foreground"
                    }`}
                  >
                    {new Date(msg.created_date).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={handleSend} className="flex gap-2 p-3 border-t bg-white shrink-0">
        <Input
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" size="icon" disabled={!input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}