const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from "react";
import { Clock, CheckCircle, AlertTriangle, Calendar } from "lucide-react";

import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import DelayBadge from "@/components/DelayBadge";
import MobileSelect from "@/components/MobileSelect";

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
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
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
    <div className="flex flex-col h-screen">
      <div className="bg-white border-b px-4 py-3">
        <BackButton className="text-sm" />
      </div>
      <Header user={user} title="Route Schedule" subtitle="Scheduled vs Actual Arrival" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
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
              <div className="p-4 rounded-xl bg-white border">
                <CheckCircle className="w-4 h-4 text-green-600 mb-1" />
                <p className="text-2xl font-bold">{onTimeCount}</p>
                <p className="text-xs text-muted-foreground">On Time</p>
              </div>
              <div className="p-4 rounded-xl bg-white border">
                <AlertTriangle className="w-4 h-4 text-amber-600 mb-1" />
                <p className="text-2xl font-bold">{delayedCount}</p>
                <p className="text-xs text-muted-foreground">Delayed</p>
              </div>
              <div className="p-4 rounded-xl bg-white border">
                <Calendar className="w-4 h-4 text-blue-600 mb-1" />
                <p className="text-2xl font-bold">
                  {completedStops.length}/{sortedStops.length}
                </p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          )}

          {sortedStops.length > 0 ? (
            <div className="bg-white rounded-xl border overflow-hidden overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50">
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