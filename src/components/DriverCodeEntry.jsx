const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from "react";
import { KeyRound, AlertCircle, Route as RouteIcon, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SubRouteSelector from "@/components/SubRouteSelector";
import { isClaimActive } from "@/lib/busUtils";

export default function DriverCodeEntry({ user, onAssigned }) {
  const [mode, setMode] = useState("code");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [takeoverBus, setTakeoverBus] = useState(null);

  const claimRoute = async (bus, driverType) => {
    const updates = {
      active_driver_id: user.id,
      active_driver_type: driverType,
      claim_start_time: new Date().toISOString(),
      status: "active",
    };
    if (!bus.assigned_driver_id) {
      updates.assigned_driver_id = user.id;
    }
    await db.entities.Bus.update(bus.id, updates);
    const updated = await db.auth.updateMe({
      bus_id: bus.id,
      school_name: bus.school_name,
    });
    onAssigned(updated);
  };

  const checkAndClaim = async (bus) => {
    const driverType =
      !bus.assigned_driver_id || bus.assigned_driver_id === user.id ? "regular" : "sub";
    if (isClaimActive(bus) && bus.active_driver_id !== user.id) {
      setTakeoverBus({ bus, driverType });
      return;
    }
    try {
      await claimRoute(bus, driverType);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (code.length !== 6) {
      setError("Please enter your 6-character code");
      return;
    }
    setLoading(true);
    try {
      const buses = await db.entities.Bus.filter({ join_code: code.toUpperCase() });
      if (buses.length === 0) {
        setError("Invalid code. Check with your school administrator.");
        return;
      }
      await checkAndClaim(buses[0]);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTakeoverConfirm = async () => {
    setLoading(true);
    try {
      await claimRoute(takeoverBus.bus, takeoverBus.driverType);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setTakeoverBus(null);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-6">
            <button
              onClick={() => {
                setMode("code");
                setError("");
              }}
              className={`flex-1 h-11 rounded-md text-sm font-medium transition-colors touch-none flex items-center justify-center ${
                mode === "code" ? "bg-white shadow text-slate-900" : "text-muted-foreground"
              }`}
            >
              <KeyRound className="w-4 h-4 inline mr-1.5" /> Enter Code
            </button>
            <button
              onClick={() => {
                setMode("select");
                setError("");
              }}
              className={`flex-1 h-11 rounded-md text-sm font-medium transition-colors touch-none flex items-center justify-center ${
                mode === "select" ? "bg-white shadow text-slate-900" : "text-muted-foreground"
              }`}
            >
              <RouteIcon className="w-4 h-4 inline mr-1.5" /> Select Route
            </button>
          </div>

          {mode === "code" ? (
            <>
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold">Enter Your Bus Code</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter the 6-character code your school administrator gave you.
                </p>
              </div>
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="ABC123"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                  }
                  className="text-center text-2xl font-mono tracking-[0.5em] h-14"
                  autoFocus
                />
                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}
                <Button type="submit" disabled={loading} className="w-full h-11" size="lg">
                  {loading ? "Activating…" : "Activate Bus"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <SubRouteSelector user={user} onClaim={checkAndClaim} />
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3 mt-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {takeoverBus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg">Route In Use</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Bus #{takeoverBus.bus.bus_number} is currently active. Take over route?
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setTakeoverBus(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleTakeoverConfirm}
                disabled={loading}
              >
                {loading ? "Taking over…" : "Take Over"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}