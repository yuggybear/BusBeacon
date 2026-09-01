const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect, useRef } from "react";
import { Megaphone, AlertTriangle, Bus as BusIcon, X, RefreshCw } from "lucide-react";

import { usePullToRefresh } from "@/hooks/usePullToRefresh";

export default function BroadcastFeed({ schoolName, role, busId }) {
  const [broadcasts, setBroadcasts] = useState([]);
  const [dismissed, setDismissed] = useState([]);
  const [notifyBroadcasts, setNotifyBroadcasts] = useState(true);
  const feedRef = useRef(null);

  const refreshBroadcasts = async () => {
    if (!schoolName) return;
    const all = await db.entities.Broadcast.filter(
      { school_name: schoolName },
      "-created_date",
      20
    );
    const relevant = all.filter((b) => {
      if (role === "parent") {
        return (
          b.audience === "all" ||
          b.audience === "all_parents" ||
          (b.audience === "bus_specific" && b.target_bus_id === busId)
        );
      }
      if (role === "driver") {
        return (
          b.audience === "all" ||
          b.audience === "all_drivers" ||
          (b.audience === "bus_specific" && b.target_bus_id === busId)
        );
      }
      return false;
    });
    setBroadcasts(relevant);
    setDismissed([]);
  };

  const { pullDistance, refreshing } = usePullToRefresh(feedRef, refreshBroadcasts);

  useEffect(() => {
    if (!schoolName) return;
    db.auth.me().then((u) => {
      if (u?.notify_broadcasts === false) setNotifyBroadcasts(false);
    }).catch(() => {});
    db.entities.Broadcast
      .filter({ school_name: schoolName }, "-created_date", 20)
      .then((all) => {
        const relevant = all.filter((b) => {
          if (role === "parent") {
            return (
              b.audience === "all" ||
              b.audience === "all_parents" ||
              (b.audience === "bus_specific" && b.target_bus_id === busId)
            );
          }
          if (role === "driver") {
            return (
              b.audience === "all" ||
              b.audience === "all_drivers" ||
              (b.audience === "bus_specific" && b.target_bus_id === busId)
            );
          }
          return false;
        });
        setBroadcasts(relevant);
      })
      .catch(() => {});
  }, [schoolName, role, busId]);

  useEffect(() => {
    const unsub = db.entities.Broadcast.subscribe((event) => {
      if (event.type !== "create") return;
      const b = event.data;
      if (b.school_name !== schoolName) return;
      let relevant = false;
      if (role === "parent") {
        relevant =
          b.audience === "all" ||
          b.audience === "all_parents" ||
          (b.audience === "bus_specific" && b.target_bus_id === busId);
      } else if (role === "driver") {
        relevant =
          b.audience === "all" ||
          b.audience === "all_drivers" ||
          (b.audience === "bus_specific" && b.target_bus_id === busId);
      }
      if (relevant) {
        setBroadcasts((prev) => [b, ...prev].slice(0, 20));
        if (
          notifyBroadcasts &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          new Notification(b.title || "New Alert", { body: b.message });
        }
      }
    });
    return unsub;
  }, [schoolName, role, busId]);

  const visible = broadcasts.filter((b) => !dismissed.includes(b.id));
  if (visible.length === 0) return null;

  return (
    <div ref={feedRef} className="space-y-2">
      {(pullDistance > 0 || refreshing) && (
        <div className="flex items-center justify-center py-1" style={{ minHeight: pullDistance }}>
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
        </div>
      )}
      {visible.slice(0, 3).map((b) => (
        <div
          key={b.id}
          className={`p-3 rounded-xl border ${
            b.priority === "urgent"
              ? "bg-red-50 border-red-300"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          <div className="flex items-start gap-2">
            <div
              className={`shrink-0 ${
                b.priority === "urgent" ? "text-red-600" : "text-amber-600"
              }`}
            >
              {b.priority === "urgent" ? (
                <AlertTriangle className="w-4 h-4 mt-0.5" />
              ) : b.sender_role === "driver" ? (
                <BusIcon className="w-4 h-4 mt-0.5" />
              ) : (
                <Megaphone className="w-4 h-4 mt-0.5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {b.title && <p className="font-semibold text-sm">{b.title}</p>}
                {b.priority === "urgent" && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-200 text-red-800 font-medium">
                    URGENT
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{b.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {b.sender_name} •{" "}
                {new Date(b.created_date).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <button
              onClick={() => setDismissed((prev) => [...prev, b.id])}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}