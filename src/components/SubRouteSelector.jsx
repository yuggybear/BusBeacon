const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import MobileSelect from "@/components/MobileSelect";
import { isClaimActive } from "@/lib/busUtils";

export default function SubRouteSelector({ user, onClaim }) {
  const [buses, setBuses] = useState([]);
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedBusId, setSelectedBusId] = useState("");
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    db.entities.Bus.list()
      .then((allBuses) => {
        setBuses(allBuses);
        const schoolNames = [...new Set(allBuses.map((b) => b.school_name).filter(Boolean))];
        setSchools(schoolNames);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const availableBuses = selectedSchool
    ? buses.filter((b) => b.school_name === selectedSchool && !isClaimActive(b))
    : [];

  const selectedBus = buses.find((b) => b.id === selectedBusId);

  const handleStart = async () => {
    if (!selectedBus) return;
    setClaiming(true);
    try {
      await onClaim(selectedBus);
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold">Sub Driver — Select Route</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose your school and pick an available route to start driving.
        </p>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">School</label>
        <MobileSelect
          value={selectedSchool}
          onChange={(val) => {
            setSelectedSchool(val);
            setSelectedBusId("");
          }}
          options={schools.map((s) => ({ value: s, label: s }))}
          placeholder="Select your school…"
        />
      </div>
      {selectedSchool && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Available Routes
          </label>
          {availableBuses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              No unassigned routes available for this school.
            </p>
          ) : (
            <MobileSelect
              value={selectedBusId}
              onChange={(val) => setSelectedBusId(val)}
              options={availableBuses.map((b) => ({
                value: b.id,
                label: `Bus #${b.bus_number} — ${b.trip_direction === "from_school" ? "Afternoon Run" : "Morning Run"}`,
              }))}
              placeholder="Select a route…"
            />
          )}
        </div>
      )}
      <Button
        onClick={handleStart}
        disabled={!selectedBusId || claiming}
        className="w-full h-11"
        size="lg"
      >
        {claiming ? "Starting…" : "Start Route"}
      </Button>
    </div>
  );
}