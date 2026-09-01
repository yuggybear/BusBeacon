const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from "react";
import { Users, Plus, Trash2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MobileSelect from "@/components/MobileSelect";

export default function ParentStudentManager({ user, onLinksChanged }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [code, setCode] = useState("");
  const [bus, setBus] = useState(null);
  const [stops, setStops] = useState([]);
  const [selectedStopId, setSelectedStopId] = useState("");
  const [childName, setChildName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const loadLinks = async () => {
    const data = await db.entities.ParentLink.filter({
      school_name: user.school_name,
    });
    const myLinks = data.filter((l) => l.created_by_id === user.id);
    setLinks(myLinks);
    setLoading(false);
    return myLinks;
  };

  useEffect(() => {
    loadLinks();
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    if (code.length !== 6) {
      setError("Please enter a 6-character code");
      return;
    }
    setVerifying(true);
    try {
      const buses = await db.entities.Bus.filter({
        join_code: code.toUpperCase(),
      });
      if (buses.length === 0) {
        setError("Invalid code. Check with your school administrator.");
        setVerifying(false);
        return;
      }
      const foundBus = buses[0];
      setBus(foundBus);
      const stopData = await db.entities.Stop.filter({ bus_id: foundBus.id });
      setStops(stopData.sort((a, b) => a.stop_order - b.stop_order));
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setVerifying(false);
  };

  const handleAdd = async () => {
    setSaving(true);
    setError("");
    try {
      await db.entities.ParentLink.create({
        student_name: childName.trim(),
        bus_id: bus.id,
        stop_id: selectedStopId,
        school_name: bus.school_name,
      });
      if (links.length === 0) {
        await db.auth.updateMe({
          school_name: bus.school_name,
          bus_id: bus.id,
          stop_id: selectedStopId,
          child_name: childName.trim(),
        });
      }
      await loadLinks();
      onLinksChanged?.();
      setCode("");
      setBus(null);
      setStops([]);
      setSelectedStopId("");
      setChildName("");
      setShowAdd(false);
    } catch (e) {
      setError(e.message || "Failed to add student");
    }
    setSaving(false);
  };

  const handleDelete = async (link) => {
    await db.entities.ParentLink.delete(link.id);
    if (link.bus_id === user.bus_id) {
      const remaining = links.filter((l) => l.id !== link.id);
      if (remaining.length > 0) {
        await db.auth.updateMe({
          bus_id: remaining[0].bus_id,
          stop_id: remaining[0].stop_id,
          child_name: remaining[0].student_name,
        });
      } else {
        await db.auth.updateMe({
          bus_id: "",
          stop_id: "",
          child_name: "",
        });
      }
    }
    await loadLinks();
    onLinksChanged?.();
  };

  if (loading) return null;

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold">My Students</h2>
        </div>
        {!showAdd && (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> Add Student
          </Button>
        )}
      </div>

      <div className="space-y-2 mb-4">
        {links.length === 0 && !showAdd && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No students linked yet. Add one to start tracking.
          </p>
        )}
        {links.map((link) => {
          const stop = stops.find((s) => s.id === link.stop_id);
          return (
            <div
              key={link.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{link.student_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {stop ? `Stop ${stop.stop_order}: ${stop.name}` : "Bus stop assigned"}
                </p>
              </div>
              <button
                onClick={() => handleDelete(link)}
                className="h-11 w-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 shrink-0 touch-none"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <div className="space-y-3 p-4 rounded-lg border bg-slate-50">
          {!bus ? (
            <form onSubmit={handleVerify} className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground">
                Bus Join Code
              </label>
              <Input
                type="text"
                maxLength={6}
                placeholder="ABC123"
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                  )
                }
                className="text-center text-lg font-mono tracking-[0.3em] h-12"
                autoFocus
              />
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={verifying} className="flex-1">
                  {verifying ? "Verifying…" : "Find Bus"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAdd(false);
                    setError("");
                    setCode("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="p-2 rounded-lg bg-green-50 border border-green-200 text-center">
                <p className="text-sm font-medium">Bus #{bus.bus_number}</p>
                <p className="text-xs text-muted-foreground">{bus.school_name}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Your Stop
                </label>
                <MobileSelect
                  value={selectedStopId}
                  onChange={(val) => setSelectedStopId(val)}
                  options={stops.map((s) => ({
                    value: s.id,
                    label: `Stop ${s.stop_order}: ${s.name}`,
                  }))}
                  placeholder="Select stop"
                  className="w-full mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Child's Name
                </label>
                <Input
                  placeholder="e.g. Emma Johnson"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <Button
                  onClick={handleAdd}
                  disabled={saving || !selectedStopId || !childName.trim()}
                  className="flex-1"
                >
                  {saving ? "Saving…" : "Add Student"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBus(null);
                    setStops([]);
                    setError("");
                  }}
                >
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}