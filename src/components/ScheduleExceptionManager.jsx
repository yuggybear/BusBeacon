const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from "react";
import { Calendar, Plus, Trash2, Bus as BusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MobileSelect from "@/components/MobileSelect";
import { useToast } from "@/components/ui/use-toast";

const EXCEPTION_TYPES = [
  { value: "holiday", label: "Holiday", color: "bg-red-100 text-red-700" },
  { value: "no_service", label: "No Service", color: "bg-red-100 text-red-700" },
  { value: "early_dismissal", label: "Early Dismissal", color: "bg-amber-100 text-amber-700" },
  { value: "late_start", label: "Late Start", color: "bg-amber-100 text-amber-700" },
  { value: "field_trip", label: "Field Trip", color: "bg-blue-100 text-blue-700" },
];

export default function ScheduleExceptionManager({ schoolName, buses }) {
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: "",
    type: "holiday",
    title: "",
    description: "",
    affected_bus_id: "",
    alternate_time: "",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const data = await db.entities.ScheduleException.filter(
      { school_name: schoolName },
      "date"
    );
    setExceptions(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsub = db.entities.ScheduleException.subscribe((event) => {
      if (event.type === "create") {
        setExceptions((prev) =>
          [...prev, event.data].sort((a, b) => a.date.localeCompare(b.date))
        );
      } else if (event.type === "delete") {
        setExceptions((prev) => prev.filter((e) => e.id !== event.data.id));
      } else if (event.type === "update") {
        setExceptions((prev) =>
          prev.map((e) => (e.id === event.data.id ? event.data : e))
        );
      }
    });
    return unsub;
  }, [schoolName]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await db.entities.ScheduleException.create({
        school_name: schoolName,
        date: form.date,
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        affected_bus_id: form.affected_bus_id || undefined,
        alternate_time: form.alternate_time || undefined,
      });
      setForm({
        date: "",
        type: "holiday",
        title: "",
        description: "",
        affected_bus_id: "",
        alternate_time: "",
      });
      setShowForm(false);
      toast({ title: "Exception added" });
    } catch (e) {
      toast({ title: "Failed to add exception", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await db.entities.ScheduleException.delete(id);
    toast({ title: "Exception removed" });
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-4 border-t">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-sm">Schedule Exceptions</h3>
        </div>
        <Button size="sm" variant="outline" className="h-11" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>

      {showForm && (
        <div className="space-y-2 mb-3 p-3 rounded-lg bg-slate-50 border">
          <Input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <MobileSelect
            value={form.type}
            onChange={(val) => setForm({ ...form, type: val })}
            options={EXCEPTION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
          <Input
            placeholder="Title (e.g. Memorial Day, Snow Day)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Input
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex gap-2">
            <MobileSelect
              value={form.affected_bus_id}
              onChange={(val) => setForm({ ...form, affected_bus_id: val })}
              options={buses.map((b) => ({
                value: b.id,
                label: `Bus #${b.bus_number}`,
              }))}
              placeholder="All Buses"
              className="flex-1"
            />
            {(form.type === "early_dismissal" || form.type === "late_start") && (
              <Input
                type="time"
                value={form.alternate_time}
                onChange={(e) =>
                  setForm({ ...form, alternate_time: e.target.value })
                }
                className="w-32"
              />
            )}
          </div>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={saving || !form.date || !form.title.trim()}
            className="w-full h-11"
          >
            {saving ? "Saving…" : "Add Exception"}
          </Button>
        </div>
      )}

      <div className="space-y-1.5">
        {exceptions.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground text-center py-2">
            No schedule exceptions.
          </p>
        )}
        {exceptions.map((exc) => {
          const typeInfo = EXCEPTION_TYPES.find((t) => t.value === exc.type);
          const isToday = exc.date === today;
          const isPast = exc.date < today;
          const affectedBus = buses.find((b) => b.id === exc.affected_bus_id);
          return (
            <div
              key={exc.id}
              className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${
                isToday
                  ? "bg-amber-50 border border-amber-300"
                  : isPast
                  ? "bg-slate-50 opacity-60 border"
                  : "bg-white border"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      typeInfo?.color || "bg-slate-100"
                    }`}
                  >
                    {typeInfo?.label}
                  </span>
                  {isToday && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 font-medium">
                      TODAY
                    </span>
                  )}
                </div>
                <p className="font-medium mt-1">{exc.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>
                    {new Date(exc.date + "T00:00").toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  {affectedBus && (
                    <span className="flex items-center gap-0.5">
                      <BusIcon className="w-3 h-3" /> #{affectedBus.bus_number}
                    </span>
                  )}
                  {exc.alternate_time && <span>⏰ {exc.alternate_time}</span>}
                </div>
                {exc.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {exc.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(exc.id)}
                className="text-muted-foreground hover:text-red-600 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}