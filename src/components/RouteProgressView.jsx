import db from '@/api/base44Client';

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
  }, [busIds]);

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
      } else if (event.type === "create") {
        setAllStops((prev) => ({
          ...prev,
          [event.data.bus_id]: [...(prev[event.data.bus_id] || []), event.data].sort(
            (a, b) => a.stop_order - b.stop_order
          ),
        }));
      }
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-800 border-t-slate-800 dark:border-t-slate-200 rounded-full animate-spin" />
      </div>
    );
  }

  if (buses.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No buses to track.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900">
      {buses.map((bus) => {
        const busStops = allStops[bus.id] || [];
        const currentIndex = bus.current_stop_index ?? 0;
        const completed = busStops.filter((s) => s.stop_order < currentIndex).length;
        const total = busStops.length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        const isOnRoute = bus.status === "on_route";
        const routeComplete = completed === total && total > 0;

        return (
          <div key={bus.id} className="bg-white dark:bg-slate-950 rounded-xl border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    isOnRoute ? "bg-green-500 animate-pulse" : routeComplete ? "bg-green-500" : "bg-slate-300"
                  }`}
                />
                <span className="font-semibold text-sm">Bus #{bus.bus_number}</span>
                <DelayBadge delayMinutes={bus.last_delay_minutes} />
                {isClaimActive(bus) && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      bus.active_driver_type === "sub"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {bus.active_driver_type === "sub" ? "Sub Driver" : "Regular Driver"}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {completed}/{total} stops · {progress}%
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 mb-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  routeComplete
                    ? "bg-green-500"
                    : isOnRoute
                    ? "bg-blue-600"
                    : "bg-slate-300"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            {busStops.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No stops configured.</p>
            ) : (
              <div className="space-y-0.5">
                {busStops.map((stop) => {
                  const isPassed = stop.stop_order < currentIndex;
                  const isCurrent = stop.stop_order === currentIndex;
                  return (
                    <div key={stop.id} className="flex items-center gap-2 text-sm py-1">
                      {isPassed ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      ) : isCurrent ? (
                        <div className="w-4 h-4 rounded-full bg-blue-600 shrink-0 flex items-center justify-center">
                          <MapPin className="w-2.5 h-2.5 text-white" />
                        </div>
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                      <span
                        className={
                          isPassed
                            ? "text-muted-foreground line-through"
                            : isCurrent
                            ? "font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {stop.stop_order}. {stop.name}
                      </span>
                      {stop.scheduled_time && (
                        <span className="text-xs text-muted-foreground ml-auto font-mono">
                          {stop.scheduled_time}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}