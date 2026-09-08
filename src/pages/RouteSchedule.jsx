import db from '@/api/base44Client';

import { useState, useEffect, useRef } from "react";
import { Clock, CheckCircle, AlertTriangle, Calendar, RefreshCw } from "lucide-react";

import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import DelayBadge from "@/components/DelayBadge";
import MobileSelect from "@/components/MobileSelect";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

function calcDelay(scheduled, actual) {
  const [sh, sm] = scheduled.split(":").map(Number);
  const [ah, am] = actual.split(":").map(Number);
  return ah * 60 + am - (sh * 60 + sm);
}

export default function RouteSchedule() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState("");
  const [stops, setStops] = useState([]);
  const scrollRef = useRef(null);
  const { pullDistance, refreshing } = usePullToRefresh(scrollRef, async () => {
    if (!selectedBusId) return;
    try {
      const stopData = await db.entities.Stop.filter({ bus_id: selectedBusId });
      setStops(stopData.sort((a, b) => a.stop_order - b.stop_order));
    } catch (e) {}
  });

  useEffect(() => {
    db.auth
      .me()
      .then(async (u) => {
        setUser(u);
        let busList = [];
        if (u.app_role === "admin" && u.school_name) {
          busList = await db.entities.Bus.filter({ school_name: u.school_name });
        } else if (u.bus_id) {
          const bus = await db.entities.Bus.get(u.bus_id);
          busList = [bus];
        }
        setBuses(busList);
        if (busList.length > 0) setSelectedBusId(busList[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedBusId) {
      setStops([]);
      return;
    }
    db.entities.Stop
      .filter({ bus_id: selectedBusId })
      .then((s) => setStops(s.sort((a, b) => a.stop_order - b.stop_order)))
      .catch(() => {});
  }, [selectedBusId]);

  useEffect(() => {
    const unsub = db.entities.Stop.subscribe((event) => {
      if (event.type === "update") {
        setStops((prev) => prev.map((s) => (s.id === event.data.id ? event.data : s)));
      }
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-800 border-t-slate-800 dark:border-t-slate-200 rounded-full animate-spin" />
      </div>
    );
  }

  const sortedStops = [...stops].sort((a, b) => a.stop_order - b.stop_order);
  const completedStops = sortedStops.filter((s) => s.actual_arrival);
  const onTimeCount = completedStops.filter((s) => {
    if (!s.scheduled_time || !s.actual_arrival) return false;
    return calcDelay(s.scheduled_time, s.actual_arrival) <= 0;
  }).length;
  const delayedCount = completedStops.length - onTimeCount;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] lg:h-screen">
      <Header user={user} title="Route Schedule" subtitle="Scheduled vs Actual Arrival" />
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        {(pullDistance > 0 || refreshing) && (
          <div
            className="flex items-center justify-center text-sm text-muted-foreground overflow-hidden"
            style={{ height: refreshing ? 40 : pullDistance }}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : pullDistance > 60 ? "Release to refresh" : "Pull to refresh"}
          </div>
        )}
        <div className="max-w-4xl mx-auto">
          <BackButton
            to={
              user?.app_role === "admin"
                ? "/admin"
                : user?.app_role === "driver"
                ? "/driver"
                : user?.app_role === "parent"
                ? "/parent"
                : "/"
            }
            className="mb-4"
          />
          <div className="mb-6">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">SELECT ROUTE</label>
            {buses.length > 1 ? (
              <MobileSelect
                value={selectedBusId}
                onChange={(val) => setSelectedBusId(val)}
                options={buses.map((b) => ({
                  value: b.id,
                  label: `Bus #${b.bus_number} — ${b.school_name}`,
                }))}
                className="max-w-xs"
              />
            ) : buses.length === 1 ? (
              <p className="text-sm font-medium">
                Bus #{buses[0].bus_number} — {buses[0].school_name}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No buses available.</p>
            )}
          </div>

          {sortedStops.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border">
                <CheckCircle className="w-4 h-4 text-green-600 mb-1" />
                <p className="text-2xl font-bold">{onTimeCount}</p>
                <p className="text-xs text-muted-foreground">On Time</p>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border">
                <AlertTriangle className="w-4 h-4 text-amber-600 mb-1" />
                <p className="text-2xl font-bold">{delayedCount}</p>
                <p className="text-xs text-muted-foreground">Delayed</p>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border">
                <Calendar className="w-4 h-4 text-blue-600 mb-1" />
                <p className="text-2xl font-bold">
                  {completedStops.length}/{sortedStops.length}
                </p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          )}

          {sortedStops.length > 0 ? (
            <>
              {/* Mobile: card list */}
              <div className="block md:hidden space-y-2">
                {sortedStops.map((stop) => {
                  const delay =
                    stop.scheduled_time && stop.actual_arrival
                      ? calcDelay(stop.scheduled_time, stop.actual_arrival)
                      : null;
                  return (
                    <div key={stop.id} className="bg-white dark:bg-slate-950 rounded-xl border p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                          {stop.stop_order}
                        </span>
                        <p className="font-medium text-sm flex-1 min-w-0 truncate">{stop.name}</p>
                      </div>
                      {stop.address && (
                        <p className="text-xs text-muted-foreground mb-2">{stop.address}</p>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground">
                            Sched: <span className="font-mono">{stop.scheduled_time || "—"}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Actual: <span className="font-mono">{stop.actual_arrival || "—"}</span>
                          </span>
                        </div>
                        {delay === null ? (
                          <span className="text-xs text-muted-foreground">Pending</span>
                        ) : (
                          <DelayBadge delayMinutes={delay} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block bg-white dark:bg-slate-950 rounded-xl border overflow-hidden overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-slate-50 dark:bg-slate-900">
                       <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">#</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Stop</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Scheduled</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Actual</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStops.map((stop) => {
                      const delay =
                        stop.scheduled_time && stop.actual_arrival
                          ? calcDelay(stop.scheduled_time, stop.actual_arrival)
                          : null;
                      return (
                        <tr key={stop.id} className="border-b last:border-0">
                          <td className="px-4 py-3 text-sm font-medium">{stop.stop_order}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium">{stop.name}</p>
                            {stop.address && (
                              <p className="text-xs text-muted-foreground">{stop.address}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono">{stop.scheduled_time || "—"}</td>
                          <td className="px-4 py-3 text-sm font-mono">{stop.actual_arrival || "—"}</td>
                          <td className="px-4 py-3">
                            {delay === null ? (
                              <span className="text-xs text-muted-foreground">Pending</span>
                            ) : (
                              <DelayBadge delayMinutes={delay} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-12">
              No stops found for this route.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}