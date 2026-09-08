import db from '@/api/base44Client';

import { useState } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const EXCEPTION_TYPE_LABELS = {
  holiday: "Holiday",
  no_service: "No Service",
  early_dismissal: "Early Dismissal",
  late_start: "Late Start",
  field_trip: "Field Trip",
};

export default function CalendarSync({ schoolName, onSynced }) {
  const [syncing, setSyncing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState({});
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setSyncing(true);
    setPreview(null);
    try {
      const result = await db.integrations.Core.InvokeLLM({
        prompt: `Search the web for the official academic calendar for "${schoolName}" for the current school year (2025-2026). Find all school holidays, closures, early dismissal days, late start days, professional development days, and any other schedule changes that would affect school bus transportation. For each event, provide: the date in YYYY-MM-DD format, the type (one of: holiday, no_service, early_dismissal, late_start, field_trip), a short title, an optional description, and an optional alternate_time for early dismissals or late starts in HH:MM 24-hour format. Only include events you are confident about from the search results. Do not include regular school days.`,
        add_context_from_internet: true,
        model: "gemini_3_flash",
        response_json_schema: {
          type: "object",
          properties: {
            exceptions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  type: {
                    type: "string",
                    enum: ["holiday", "no_service", "early_dismissal", "late_start", "field_trip"],
                  },
                  title: { type: "string" },
                  description: { type: "string" },
                  alternate_time: { type: "string" },
                },
                required: ["date", "type", "title"],
              },
            },
          },
        },
      });
      const exceptions = result.exceptions || [];
      if (exceptions.length === 0) {
        toast({
          title: "No calendar events found",
          description: "AI couldn't find schedule exceptions for this school.",
        });
        return;
      }
      setPreview(exceptions);
      const initial = {};
      exceptions.forEach((_, i) => (initial[i] = true));
      setSelected(initial);
    } catch (e) {
      toast({
        title: "Calendar sync failed",
        description: e.message || "Please try again later.",
        variant: "destructive",
      });
    }
    setSyncing(false);
  };

  const handleImport = async () => {
    const toImport = preview.filter((_, i) => selected[i]);
    if (toImport.length === 0) return;
    setImporting(true);
    try {
      await db.entities.ScheduleException.bulkCreate(
        toImport.map((exc) => ({
          school_name: schoolName,
          date: exc.date,
          type: exc.type,
          title: exc.title,
          description: exc.description || undefined,
          alternate_time: exc.alternate_time || undefined,
        }))
      );
      toast({ title: `Imported ${toImport.length} schedule exceptions` });
      setPreview(null);
      if (onSynced) onSynced();
    } catch (e) {
      toast({ title: "Import failed", variant: "destructive" });
    }
    setImporting(false);
  };

  if (preview) {
    const selectedCount = preview.filter((_, i) => selected[i]).length;
    return (
      <div className="space-y-2 mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">AI Found {preview.length} Events</p>
          <button
            onClick={() => setPreview(null)}
            className="h-11 w-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 shrink-0 touch-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {preview.map((exc, i) => (
            <label
              key={i}
              className="flex items-center gap-2 p-2 rounded-lg bg-white border cursor-pointer"
            >
              <input
                type="checkbox"
                checked={!!selected[i]}
                onChange={(e) => setSelected({ ...selected, [i]: e.target.checked })}
                className="w-4 h-4 accent-blue-600 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{exc.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(exc.date + "T00:00").toLocaleDateString()} •{" "}
                  {EXCEPTION_TYPE_LABELS[exc.type] || exc.type}
                  {exc.alternate_time && ` • ${exc.alternate_time}`}
                </p>
              </div>
            </label>
          ))}
        </div>
        <Button
          onClick={handleImport}
          disabled={importing || selectedCount === 0}
          className="w-full h-11"
          size="lg"
        >
          {importing ? "Importing…" : `Import Selected (${selectedCount})`}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-11"
      onClick={handleSync}
      disabled={syncing}
    >
      {syncing ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" /> Syncing…
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4" /> AI Sync
        </>
      )}
    </Button>
  );
}