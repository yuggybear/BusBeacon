const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from "react";
import { CalendarX, Clock, Bus as BusIcon } from "lucide-react";

const TYPE_CONFIG = {
  holiday: { label: "Holiday — No Bus Service", icon: CalendarX, color: "bg-red-50 border-red-300 text-red-800" },
  no_service: { label: "No Bus Service Today", icon: CalendarX, color: "bg-red-50 border-red-300 text-red-800" },
  early_dismissal: { label: "Early Dismissal Today", icon: Clock, color: "bg-amber-50 border-amber-300 text-amber-800" },
  late_start: { label: "Late Start Today", icon: Clock, color: "bg-amber-50 border-amber-300 text-amber-800" },
  field_trip: { label: "Field Trip Today", icon: BusIcon, color: "bg-blue-50 border-blue-300 text-blue-800" },
};

export default function ScheduleExceptionBanner({ schoolName, busId }) {
  const [exceptions, setExceptions] = useState([]);

  useEffect(() => {
    if (!schoolName) return;
    const today = new Date().toISOString().slice(0, 10);

    db.entities.ScheduleException
      .filter({ school_name: schoolName, date: today })
      .then((data) => {
        const relevant = data.filter(
          (e) => !e.affected_bus_id || e.affected_bus_id === busId
        );
        setExceptions(relevant);
      })
      .catch(() => {});

    const unsub = db.entities.ScheduleException.subscribe((event) => {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (event.type === "create" && event.data.date === todayStr) {
        if (!event.data.affected_bus_id || event.data.affected_bus_id === busId) {
          setExceptions((prev) =>
            prev.some((e) => e.id === event.data.id) ? prev : [...prev, event.data]
          );
        }
      } else if (event.type === "delete") {
        setExceptions((prev) => prev.filter((e) => e.id !== event.data.id));
      }
    });
    return unsub;
  }, [schoolName, busId]);

  if (exceptions.length === 0) return null;

  return (
    <div className="space-y-2 px-4 pt-3">
      {exceptions.map((exc) => {
        const config = TYPE_CONFIG[exc.type] || TYPE_CONFIG.holiday;
        const Icon = config.icon;
        return (
          <div
            key={exc.id}
            className={`p-3 rounded-xl border flex items-start gap-2 ${config.color}`}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{exc.title || config.label}</p>
              {exc.description && (
                <p className="text-xs mt-0.5 opacity-90">{exc.description}</p>
              )}
              {exc.alternate_time && (
                <p className="text-xs mt-1 font-medium">
                  Alternate time: {exc.alternate_time}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}