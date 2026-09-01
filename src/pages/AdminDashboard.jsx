const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  KeyRound,
  Copy,
  Bus as BusIcon,
  ChevronRight,
  Upload,
  Clock,
  FileCheck,
} from "lucide-react";

import Header from "@/components/Header";
import BusMap from "@/components/BusMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import DelayBadge from "@/components/DelayBadge";
import RouteProgressView from "@/components/RouteProgressView";
import RouteImport from "@/components/RouteImport";
import ScheduleExceptionManager from "@/components/ScheduleExceptionManager";
import { generateBusCode, isClaimActive } from "@/lib/busUtils";
import AdminVerificationPanel from "@/components/AdminVerificationPanel";

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buses, setBuses] = useState([]);
  const [stops, setStops] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState(null);
  const [showAddBus, setShowAddBus] = useState(false);
  const [newBusNumber, setNewBusNumber] = useState("");
  const [newStopName, setNewStopName] = useState("");
  const [newStopAddress, setNewStopAddress] = useState("");
  const [newStopLat, setNewStopLat] = useState("");
  const [newStopLng, setNewStopLng] = useState("");
  const [newStopScheduled, setNewStopScheduled] = useState("");
  const [newBusDeparture, setNewBusDeparture] = useState("");
  const [viewMode, setViewMode] = useState("map");
  const [showImport, setShowImport] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    db.auth.me()
      .then(async (u) => {
        setUser(u);
        if (u.school_name) {
          await loadBuses(u.school_name);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const unsub = db.entities.Bus.subscribe((event) => {
      if (event.type === "update") {
        setBuses((prev) => prev.map((b) => (b.id === event.data.id ? event.data : b)));
      } else if (event.type === "create") {
        setBuses((prev) => [...prev, event.data]);
      }
    });
    return unsub;
  }, []);

  // Keep admin user state in sync (verification changes, main admin transfers)
  useEffect(() => {
    if (!user?.id || user?.app_role !== "admin") return;
    const unsub = db.entities.User.subscribe((event) => {
      if (event.type === "update" && event.data.id === user.id) {
        setUser(event.data);
      }
    });
    return unsub;
  }, [user?.id, user?.app_role]);

  const loadBuses = async (schoolName) => {
    const data = await db.entities.Bus.filter({ school_name: schoolName });
    setBuses(data);
  };

  const loadStops = async (busId) => {
    const data = await db.entities.Stop.filter({ bus_id: busId });
    setStops(data.sort((a, b) => a.stop_order - b.stop_order));
  };

  const handleSelectBus = (busId) => {
    setSelectedBusId(busId);
    loadStops(busId);
  };

  const handleSaveSchool = async (schoolName) => {
    const existing = await db.entities.User.filter({
      school_name: schoolName,
      is_main_admin: true,
    });
    const hasMainAdmin = existing.some((u) => u.id !== user.id);
    const updated = await db.auth.updateMe({
      school_name: schoolName,
      is_main_admin: !hasMainAdmin,
      admin_verified: !hasMainAdmin,
    });
    setUser(updated);
    await loadBuses(schoolName);
  };

  const handleAddBus = async () => {
    if (!newBusNumber.trim()) return;
    await db.entities.Bus.create({
      bus_number: newBusNumber.trim(),
      school_name: user.school_name,
      school_district: user.school_name,
      status: "inactive",
      current_stop_index: 0,
      scheduled_departure: newBusDeparture || undefined,
      join_code: generateBusCode(),
    });
    setNewBusNumber("");
    setNewBusDeparture("");
    setShowAddBus(false);
    await loadBuses(user.school_name);
    toast({ title: "Bus added successfully" });
  };

  const handleAddStop = async () => {
    if (!newStopName.trim() || !newStopLat || !newStopLng) return;
    const nextOrder = stops.length + 1;
    await db.entities.Stop.create({
      bus_id: selectedBusId,
      name: newStopName.trim(),
      address: newStopAddress.trim(),
      latitude: parseFloat(newStopLat),
      longitude: parseFloat(newStopLng),
      stop_order: nextOrder,
      scheduled_time: newStopScheduled || undefined,
    });
    setNewStopName("");
    setNewStopAddress("");
    setNewStopLat("");
    setNewStopLng("");
    setNewStopScheduled("");
    await loadStops(selectedBusId);
    toast({ title: "Stop added successfully" });
  };

  const handleRegenerateCode = async (busId) => {
    const newCode = generateBusCode();
    await db.entities.Bus.update(busId, { join_code: newCode });
    setBuses((prev) =>
      prev.map((b) => (b.id === busId ? { ...b, join_code: newCode } : b))
    );
    toast({ title: `New code: ${newCode}` });
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Code copied to clipboard" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user.school_name) {
    return <SchoolSetup user={user} onSaved={handleSaveSchool} />;
  }

  if (user.app_role === "admin" && !user.admin_verified) {
    return <PendingVerification user={user} onVerified={(u) => setUser(u)} />;
  }

  const selectedBus = buses.find((b) => b.id === selectedBusId);

  return (
    <div className="flex flex-col h-screen">
      <Header
        user={user}
        title={`BusTrack — ${user.school_name}`}
        subtitle="Administrator Dashboard"
      />
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        {/* Left panel */}
        <div className="lg:w-[400px] lg:border-r border-b lg:border-b-0 lg:overflow-y-auto bg-white shrink-0">
          {user.is_main_admin && (
            <AdminVerificationPanel
              schoolName={user.school_name}
              currentUserId={user.id}
            />
          )}
          {/* Bus list */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Buses ({buses.length})</h2>
              <Button size="sm" variant="outline" onClick={() => setShowAddBus(!showAddBus)}>
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>
            {showAddBus && (
              <div className="space-y-2 mb-3 p-3 rounded-lg bg-slate-50 border">
                <Input
                  placeholder="Bus number"
                  value={newBusNumber}
                  onChange={(e) => setNewBusNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddBus()}
                />
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={newBusDeparture}
                    onChange={(e) => setNewBusDeparture(e.target.value)}
                  />
                  <Button size="sm" onClick={handleAddBus}>Add</Button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {buses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No buses yet. Add one to get started.
                </p>
              ) : (
                buses.map((bus) => (
                  <button
                    key={bus.id}
                    onClick={() => handleSelectBus(bus.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                      selectedBusId === bus.id
                        ? "bg-blue-50 border-blue-300"
                        : "bg-white hover:bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white shrink-0">
                      <BusIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">Bus #{bus.bus_number}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 tracking-wider">
                          {bus.join_code || "—"}
                        </span>
                        {bus.join_code && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              copyCode(bus.join_code);
                            }}
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            bus.status === "on_route"
                              ? "bg-green-100 text-green-700"
                              : bus.status === "active"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {bus.status === "on_route"
                            ? "On Route"
                            : bus.status === "active"
                            ? "Active"
                            : "Inactive"}
                        </span>
                        <DelayBadge delayMinutes={bus.last_delay_minutes} />
                        {isClaimActive(bus) && (
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full ${
                              bus.active_driver_type === "sub"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {bus.active_driver_type === "sub" ? "Active (Sub)" : "Active (Regular)"}
                          </span>
                        )}
                        {bus.assigned_driver_id && !isClaimActive(bus) && (
                          <span className="text-xs text-muted-foreground">Driver assigned</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Selected bus stops */}
          {selectedBus && (
            <div className="p-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">
                  Stops — Bus #{selectedBus.bus_number}
                </h3>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowImport(!showImport)}
                  >
                    <Upload className="w-4 h-4" /> Import
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRegenerateCode(selectedBus.id)}
                  >
                    <KeyRound className="w-4 h-4" /> New Code
                  </Button>
                </div>
              </div>
              {showImport && (
                <RouteImport
                  user={user}
                  selectedBus={selectedBus}
                  onImported={() => {
                    loadStops(selectedBus.id);
                    setShowImport(false);
                  }}
                />
              )}
              <div className="space-y-1.5 mb-3">
                {stops.map((stop) => (
                  <div
                    key={stop.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 text-sm"
                  >
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                      {stop.stop_order}
                    </span>
                    <span className="truncate">{stop.name}</span>
                  </div>
                ))}
                {stops.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">No stops yet.</p>
                )}
              </div>
              <div className="space-y-2 p-3 rounded-lg border bg-slate-50">
                <Input
                  placeholder="Stop name"
                  value={newStopName}
                  onChange={(e) => setNewStopName(e.target.value)}
                />
                <Input
                  placeholder="Address (optional)"
                  value={newStopAddress}
                  onChange={(e) => setNewStopAddress(e.target.value)}
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Latitude"
                    value={newStopLat}
                    onChange={(e) => setNewStopLat(e.target.value)}
                  />
                  <Input
                    placeholder="Longitude"
                    value={newStopLng}
                    onChange={(e) => setNewStopLng(e.target.value)}
                  />
                </div>
                <Input
                  type="time"
                  value={newStopScheduled}
                  onChange={(e) => setNewStopScheduled(e.target.value)}
                />
                <Button size="sm" onClick={handleAddStop} className="w-full">
                  Add Stop
                </Button>
              </div>
            </div>
          )}

          {/* Schedule Exceptions */}
          <ScheduleExceptionManager schoolName={user.school_name} buses={buses} />

        </div>

        {/* Map / Progress */}
        <div className="flex-1 min-h-[300px] lg:min-h-0 flex flex-col">
          <div className="flex items-center gap-1 p-2 border-b bg-white shrink-0">
            <button
              onClick={() => setViewMode("map")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === "map"
                  ? "bg-blue-600 text-white"
                  : "text-muted-foreground hover:bg-slate-100"
              }`}
            >
              Map View
            </button>
            <button
              onClick={() => setViewMode("progress")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === "progress"
                  ? "bg-blue-600 text-white"
                  : "text-muted-foreground hover:bg-slate-100"
              }`}
            >
              Route Progress
            </button>
          </div>
          <div className="flex-1 min-h-0">
            {viewMode === "map" ? (
              <BusMap buses={buses} stops={selectedBusId ? stops : []} />
            ) : (
              <RouteProgressView buses={buses} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SchoolSetup({ user, onSaved }) {
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await onSaved(schoolName.trim());
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-4">
              <Building2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold">School Setup</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your school name to start managing your buses.
            </p>
          </div>
          <div className="space-y-3">
            <Input
              placeholder="e.g. Riverside Elementary"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="h-11"
              onKeyDown={(e) => e.key === "Enter" && schoolName.trim() && handleSave()}
            />
            <Button
              onClick={handleSave}
              disabled={loading || !schoolName.trim()}
              className="w-full h-11"
              size="lg"
            >
              {loading ? "Setting up…" : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingVerification({ user, onVerified }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      const updated = await db.auth.updateMe({
        admin_verified: true,
        admin_document_url: file_url,
      });
      onVerified(updated);
    } catch (e) {
      setError(e.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  if (user.is_main_admin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-4">
                <FileCheck className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold">Verify Your Admin Status</h2>
              <p className="text-sm text-muted-foreground mt-2">
                As the main administrator for <strong>{user.school_name}</strong>, please
                upload documentation verifying your administrator status (e.g., staff badge,
                authorization letter, or school-issued ID).
              </p>
            </div>
            <div className="space-y-3">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-400 transition-colors">
                {file ? (
                  <>
                    <FileCheck className="w-8 h-8 text-green-600 mb-2" />
                    <span className="text-sm font-medium text-slate-700">{file.name}</span>
                    <span className="text-xs text-slate-400 mt-1">Click to change</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-sm text-slate-500">Click to upload documentation</span>
                    <span className="text-xs text-slate-400 mt-1">PDF, PNG, JPG, or DOC</span>
                  </>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={(e) => setFile(e.target.files[0])}
                />
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                onClick={handleUpload}
                disabled={loading || !file}
                className="w-full h-11"
                size="lg"
              >
                {loading ? "Uploading…" : "Verify & Continue"}
              </Button>
              <button
                onClick={async () => {
                  const updated = await db.auth.updateMe({ admin_verified: true });
                  onVerified(updated);
                }}
                className="w-full text-xs text-muted-foreground hover:text-foreground pt-2"
              >
                Skip verification (testing only)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 mb-4">
            <Clock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold">Awaiting Verification</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Your admin account for <strong>{user.school_name}</strong> is pending
            verification by the school's main administrator. You'll be granted access
            automatically once verified.
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            This page will update automatically — no refresh needed.
          </p>
        </div>
      </div>
    </div>
  );
}