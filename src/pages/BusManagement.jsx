const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from "react";
import { Bus as BusIcon, Save, UserX, MapPin, RotateCcw } from "lucide-react";
import { Navigate } from "react-router-dom";

import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { isClaimActive } from "@/lib/busUtils";

export default function BusManagement() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buses, setBuses] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    db.auth
      .me()
      .then(async (u) => {
        setUser(u);
        if (u.app_role === "admin" && u.school_name) {
          const busList = await db.entities.Bus.filter({ school_name: u.school_name });
          setBuses(busList);
          const userList = await db.entities.User.list();
          setDrivers(userList);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpdateBus = async (busId, updates) => {
    await db.entities.Bus.update(busId, updates);
    setBuses((prev) => prev.map((b) => (b.id === busId ? { ...b, ...updates } : b)));
    setEditingId(null);
    toast({ title: "Bus updated successfully" });
  };

  const handleResetClaim = async (busId) => {
    await db.entities.Bus.update(busId, {
      active_driver_id: "",
      active_driver_type: "",
      claim_start_time: "",
    });
    setBuses((prev) =>
      prev.map((b) =>
        b.id === busId
          ? { ...b, active_driver_id: "", active_driver_type: "", claim_start_time: "" }
          : b
      )
    );
    toast({ title: "Route claim reset" });
  };

  const handleUnassignDriver = async (busId) => {
    await db.entities.Bus.update(busId, { assigned_driver_id: "", status: "inactive" });
    setBuses((prev) =>
      prev.map((b) =>
        b.id === busId ? { ...b, assigned_driver_id: "", status: "inactive" } : b
      )
    );
    toast({ title: "Driver unassigned" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (user?.app_role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const getDriverName = (driverId) => {
    if (!driverId) return null;
    const driver = drivers.find((d) => d.id === driverId);
    return driver ? driver.full_name || driver.email : "Unknown driver";
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-white border-b px-4 py-3">
        <BackButton className="text-sm" />
      </div>
      <Header user={user} title="Bus Management" subtitle={user.school_name} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {buses.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">No buses found.</p>
          ) : (
            buses.map((bus) => (
              <div key={bus.id} className="bg-white rounded-xl border p-5">
                {editingId === bus.id ? (
                  <EditBusForm
                    bus={bus}
                    onSave={(updates) => handleUpdateBus(bus.id, updates)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white shrink-0">
                      <BusIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-lg">Bus #{bus.bus_number}</h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
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
                      </div>
                      <div className="mt-2 space-y-1 text-sm">
                        <p className="text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5 inline mr-1" />
                          {bus.school_name} — {bus.school_district || "No district set"}
                        </p>
                        <p className="text-muted-foreground">
                          Driver: {getDriverName(bus.assigned_driver_id) || "Not assigned"}
                        </p>
                        {isClaimActive(bus) && (
                          <p className="text-muted-foreground flex items-center gap-1.5 flex-wrap">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            Active: {getDriverName(bus.active_driver_id) || "Unknown"}
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded-full ${
                                bus.active_driver_type === "sub"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {bus.active_driver_type === "sub" ? "Sub" : "Regular"}
                            </span>
                          </p>
                        )}
                        {bus.scheduled_departure && (
                          <p className="text-muted-foreground">
                            Scheduled departure: {bus.scheduled_departure}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => setEditingId(bus.id)}>
                        <Save className="w-3.5 h-3.5" /> Edit
                      </Button>
                      {isClaimActive(bus) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResetClaim(bus.id)}
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reset Claim
                        </Button>
                      )}
                      {bus.assigned_driver_id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUnassignDriver(bus.id)}
                        >
                          <UserX className="w-3.5 h-3.5" /> Unassign
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function EditBusForm({ bus, onSave, onCancel }) {
  const [busNumber, setBusNumber] = useState(bus.bus_number);
  const [schoolDistrict, setSchoolDistrict] = useState(bus.school_district || "");

  return (
    <div className="space-y-3">
      <h3 className="font-bold">Edit Bus #{bus.bus_number}</h3>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Bus Number</label>
        <Input value={busNumber} onChange={(e) => setBusNumber(e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">School District</label>
        <Input
          value={schoolDistrict}
          onChange={(e) => setSchoolDistrict(e.target.value)}
          placeholder="e.g. Riverside District"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onSave({ bus_number: busNumber, school_district: schoolDistrict })}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}