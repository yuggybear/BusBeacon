const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from "react";
import { Megaphone, Send, AlertTriangle, Bus as BusIcon } from "lucide-react";
import { Navigate } from "react-router-dom";

import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import MobileSelect from "@/components/MobileSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function AdminBroadcast() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buses, setBuses] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all_parents");
  const [targetBusId, setTargetBusId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    db.auth
      .me()
      .then(async (u) => {
        setUser(u);
        if (u.app_role === "admin" && u.school_name) {
          const busList = await db.entities.Bus.filter({ school_name: u.school_name });
          setBuses(busList);
          const broadcastList = await db.entities.Broadcast.filter(
            { school_name: u.school_name },
            "-created_date",
            50
          );
          setBroadcasts(broadcastList);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const unsub = db.entities.Broadcast.subscribe((event) => {
      if (event.type === "create") {
        setBroadcasts((prev) => [event.data, ...prev].slice(0, 50));
      }
    });
    return unsub;
  }, []);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const targetBus = buses.find((b) => b.id === targetBusId);
      await db.entities.Broadcast.create({
        sender_name: user.full_name || user.email,
        sender_role: "admin",
        school_name: user.school_name,
        title: title.trim() || undefined,
        message: message.trim(),
        audience,
        target_bus_id: audience === "bus_specific" ? targetBusId : undefined,
        target_bus_number:
          audience === "bus_specific" && targetBus ? targetBus.bus_number : undefined,
        priority,
      });
      setTitle("");
      setMessage("");
      setTargetBusId("");
      setPriority("normal");
      setAudience("all_parents");
      toast({ title: "Broadcast sent successfully" });
    } catch (e) {
      toast({ title: "Failed to send broadcast", variant: "destructive" });
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (user?.app_role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const audienceLabels = {
    all: "Everyone",
    all_parents: "All Parents",
    all_drivers: "All Drivers",
    bus_specific: "Specific Bus",
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-white border-b px-4 py-3">
        <BackButton className="text-sm" />
      </div>
      <Header user={user} title="Broadcast" subtitle={user.school_name} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Megaphone className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold">Send Broadcast</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title (optional)</label>
                <Input
                  placeholder="e.g. School Closure Notice"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Message</label>
                <Textarea
                  placeholder="Type your message…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mt-1 min-h-[100px]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Send To</label>
                <MobileSelect
                  value={audience}
                  onChange={(val) => setAudience(val)}
                  options={[
                    { value: "all_parents", label: "All Parents" },
                    { value: "all_drivers", label: "All Drivers" },
                    { value: "all", label: "Everyone (Parents & Drivers)" },
                    { value: "bus_specific", label: "Specific Bus (parents + driver)" },
                  ]}
                  className="w-full mt-1"
                />
              </div>
              {audience === "bus_specific" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Select Bus</label>
                  <MobileSelect
                    value={targetBusId}
                    onChange={(val) => setTargetBusId(val)}
                    options={buses.map((b) => ({
                      value: b.id,
                      label: `Bus #${b.bus_number}`,
                    }))}
                    placeholder="Select a bus"
                    className="w-full mt-1"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setPriority("normal")}
                    className={`flex-1 h-11 rounded-lg text-sm font-medium border transition-colors touch-none ${
                      priority === "normal"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-muted-foreground border-input"
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => setPriority("urgent")}
                    className={`flex-1 h-11 rounded-lg text-sm font-medium border transition-colors touch-none ${
                      priority === "urgent"
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-white text-muted-foreground border-input"
                    }`}
                  >
                    Urgent
                  </button>
                </div>
              </div>
              <Button
                onClick={handleSend}
                disabled={sending || !message.trim() || (audience === "bus_specific" && !targetBusId)}
                className="w-full h-11"
                size="lg"
              >
                {sending ? (
                  "Sending…"
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send Broadcast
                  </>
                )}
              </Button>
            </div>
          </div>

          <div>
            <h2 className="font-bold text-sm mb-3">RECENT BROADCASTS</h2>
            <div className="space-y-2">
              {broadcasts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 bg-white rounded-xl border">
                  No broadcasts sent yet.
                </p>
              ) : (
                broadcasts.map((b) => (
                  <div key={b.id} className="bg-white rounded-xl border p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
                          b.priority === "urgent"
                            ? "bg-red-100 text-red-600"
                            : b.sender_role === "driver"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {b.priority === "urgent" ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : b.sender_role === "driver" ? (
                          <BusIcon className="w-4 h-4" />
                        ) : (
                          <Megaphone className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {b.title && <p className="font-medium text-sm">{b.title}</p>}
                          {b.priority === "urgent" && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                              URGENT
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {audienceLabels[b.audience] || b.audience}
                            {b.target_bus_number && ` — Bus #${b.target_bus_number}`}
                          </span>
                        </div>
                        <p className="text-sm mt-1">{b.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {b.sender_name} • {new Date(b.created_date).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}