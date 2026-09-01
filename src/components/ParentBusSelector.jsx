const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from "react";
import { Users, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MobileSelect from "@/components/MobileSelect";

export default function ParentBusSelector({ user, onSaved }) {
  const [code, setCode] = useState("");
  const [bus, setBus] = useState(null);
  const [stops, setStops] = useState([]);
  const [selectedStopId, setSelectedStopId] = useState("");
  const [childName, setChildName] = useState(user.child_name || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    if (code.length !== 6) {
      setError("Please enter your 6-character code");
      return;
    }
    setVerifying(true);
    try {
      const buses = await db.entities.Bus.filter({ join_code: code.toUpperCase() });
      if (buses.length === 0) {
        setError("Invalid code. Check with your school administrator.");
        setVerifying(false);
        return;
      }
      const foundBus = buses[0];
      setBus(foundBus);
      const stopData = await db.entities.Stop.filter({ bus_id: foundBus.id });
      setStops(stopData.sort((a, b) => a.stop_order - b.stop_order));
    } catch (err) {
      setError("Something went wrong. Please try again.");
    }
    setVerifying(false);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await db.entities.ParentLink.create({
        student_name: childName.trim(),
        bus_id: bus.id,
        stop_id: selectedStopId,
        school_name: bus.school_name,
      });
      const updated = await db.auth.updateMe({
        school_name: bus.school_name,
        bus_id: bus.id,
        stop_id: selectedStopId,
        child_name: childName.trim(),
      });
      onSaved(updated);
    } catch (err) {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500 text-white mb-4">
              <Users className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold">Join Your Bus</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the 6-character code from your school administrator.
            </p>
          </div>

          {!bus ? (
            <form onSubmit={handleVerify} className="space-y-4">
              <Input
                type="text"
                maxLength={6}
                placeholder="ABC123"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                className="text-center text-2xl font-mono tracking-[0.5em] h-14"
                autoFocus
              />
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              <Button type="submit" disabled={verifying} className="w-full h-11" size="lg">
                {verifying ? "Verifying…" : "Find Bus"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center">
                <p className="text-sm font-medium">Bus #{bus.bus_number}</p>
                <p className="text-xs text-muted-foreground">{bus.school_name}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Your Stop</label>
                <MobileSelect
                  value={selectedStopId}
                  onChange={(val) => setSelectedStopId(val)}
                  options={stops.map((s) => ({
                    value: s.id,
                    label: `Stop ${s.stop_order}: ${s.name}`,
                  }))}
                  placeholder="Select your stop"
                  className="w-full mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Child's Name</label>
                <Input
                  placeholder="e.g. Emma Johnson"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                />
              </div>
              <Button
                onClick={handleSave}
                disabled={loading || !selectedStopId || !childName.trim()}
                className="w-full h-11"
                size="lg"
              >
                {loading ? "Saving…" : "Start Tracking"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}