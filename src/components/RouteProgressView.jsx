const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, MapPin } from "lucide-react";

import DelayBadge from "@/components/DelayBadge";
import { isClaimActive } from "@/lib/busUtils";

export default function RouteProgressView({ buses }) {
  const [allStops, setAllStops] = useState({});
  const [loading, setLoading] = useState(true);

  const busIds = buses.map((b) => b.id).join(",");

  useEffect(() => {
    if (!buses.length) {
      setAllStops({});
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all(
      buses.map((bus) =>
        db.entities.Stop
          .filter({ bus_id: bus.id })
          .then((stops) => [bus.id, stops.sort((a, b) => a.stop_order - b.stop_order)])
      )
    )
      .then((entries) => setAllStops(Object.fromEntries(entries)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [busIds, buses]);

  useEffect(() => {
    const unsub = db.entities.Stop.subscribe((event) => {
      if (event.type === "update") {
        setAllStops((prev) => {
          const busId = event.data.bus_id;
          const busStops = prev[busId];
          if (!busStops) return prev;

          return {
            ...prev,
            [busId]: busStops.map((s) => (s.id === event.data.id ? event.data : s)),
          };
        });
      }
    });

    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[220px]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!buses.length) {
    return (
      <div className="flex items-center justify-center h-full min-h-[220px] text-sm text-muted-foreground">
        No buses available.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto">
      {buses.map((bus) => {
        const stops = allStops[bus.id] || [];
        const completed = stops.filter((stop) => stop.actual_arrival).length;
        const total = stops.length;
        const currentStop = stops.find((stop) => !stop.actual_arrival) || stops[stops.length - 1];
        const delayMinutes = bus.current_delay_minutes ?? null;
        const isActive = isClaimActive(bus);

        return (
          <div key={bus.id} className="rounded-xl border bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-semibold">Bus #{bus.bus_number}</p>
                <p className="text-xs text-muted-foreground">{bus.driver_name || "Driver TBD"}</p>
              </div>
              <div className="flex items-center gap-2">
                {isActive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    <Circle className="h-2.5 w-2.5 fill-current" /> Active
                  </span>
                )}
                <DelayBadge delayMinutes={delayMinutes} />
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{completed}/{total} completed</span>
              <span>{Math.round((completed / (total || 1)) * 100)}%</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
              />
            </div>

            <div className="mt-4 space-y-2">
              {stops.length === 0 ? (
                <p className="text-xs text-muted-foreground">No stops configured.</p>
              ) : (
                stops.slice(0, 5).map((stop, index) => {
                  const isDone = Boolean(stop.actual_arrival);
                  const isCurrent = currentStop && stop.id === currentStop.id;

                  return (
                    <div key={stop.id} className="flex items-start gap-3 rounded-lg bg-slate-50 p-2">
                      <div className="mt-0.5">
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : isCurrent ? (
                          <MapPin className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{stop.name}</p>
                          {stop.scheduled_time && (
                            <span className="text-[10px] uppercase text-muted-foreground">{stop.scheduled_time}</span>
                          )}
                        </div>
                        {stop.actual_arrival ? (
                          <p className="text-[11px] text-muted-foreground">Arrived {stop.actual_arrival}</p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            {isCurrent ? "Current stop" : `Stop ${index + 1}`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}