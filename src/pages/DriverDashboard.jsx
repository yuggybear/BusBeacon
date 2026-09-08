import db from '@/api/base44Client';

import { useState, useEffect, useRef } from "react";
import { Navigation, Flag, Play, Square, AlertTriangle, RefreshCw } from "lucide-react";
import { Navigate } from "react-router-dom";

import Header from "@/components/Header";
import BusMap from "@/components/BusMap";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { haversineDistance, isClaimActive } from "@/lib/busUtils";
import DelayBadge from "@/components/DelayBadge";
import MobileSelect from "@/components/MobileSelect";
import DriverBroadcast from "@/components/DriverBroadcast";
import BroadcastFeed from "@/components/BroadcastFeed";
import ScheduleExceptionBanner from "@/components/ScheduleExceptionBanner";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

export default function DriverDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bus, setBus] = useState(null);
  const [stops, setStops] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const { toast } = useToast();
  const notifiedDriverProximity = useRef(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueType, setIssueType] = useState("delay");
  const [issueDesc, setIssueDesc] = useState("");
  const [tripDirection, setTripDirection] = useState("to_school");
  const delayAlertSent = useRef(false);
  const scrollRef = useRef(null);
  const { pullDistance, refreshing } = usePullToRefresh(scrollRef, async () => {
    if (!user?.bus_id) return;
    try {
      const busData = await db.entities.Bus.get(user.bus_id);
      setBus(busData);
      const stopData = await db.entities.Stop.filter({ bus_id: user.bus_id });
      setStops(stopData.sort((a, b) => a.stop_order - b.stop_order));
    } catch (e) {}
  });

  useEffect(() => {
    db.auth.me()
      .then(async (u) => {
        setUser(u);
        if (u.bus_id) {
          const busData = await db.entities.Bus.get(u.bus_id);
          setBus(busData);
          const stopData = await db.entities.Stop.filter({ bus_id: u.bus_id });
          setStops(stopData.sort((a, b) => a.stop_order - b.stop_order));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Subscribe to bus updates
  useEffect(() => {
    if (!user?.bus_id) return;
    const unsub = db.entities.Bus.subscribe((event) => {
      if (event.type === "update" && event.data.id === user.bus_id) {
        setBus(event.data);
      }
    });
    return unsub;
  }, [user?.bus_id]);

  // GPS tracking — broadcast driver location
  useEffect(() => {
    if (!user?.bus_id) return;
    let lastUpdate = 0;
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastUpdate < 5000) return;
        lastUpdate = now;
        const { latitude, longitude } = pos.coords;
        setUserLocation([latitude, longitude]);
        try {
          await db.entities.Bus.update(user.bus_id, {
            current_lat: latitude,
            current_lng: longitude,
          });
        } catch (e) {
          console.error("Failed to update location:", e);
        }
      },
      (err) => console.error("Geolocation error:", err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [user?.bus_id]);

  // Proximity alert — notify driver when approaching the next stop (within 200m)
  useEffect(() => {
    if (!userLocation || !stops.length || !bus) return;
    const currentIdx = bus.current_stop_index ?? 0;
    const nextStop = stops.find((s) => s.stop_order === currentIdx);
    if (!nextStop) return;
    const dist = haversineDistance(
      userLocation[0],
      userLocation[1],
      nextStop.latitude,
      nextStop.longitude
    );
    if (dist <= 0.2 && !notifiedDriverProximity.current) {
      notifiedDriverProximity.current = true;
      toast({ title: "Approaching Stop", description: `You're near ${nextStop.name}` });
    } else if (dist > 0.4) {
      notifiedDriverProximity.current = false;
    }
  }, [userLocation, bus?.current_stop_index, stops]);

  const handleMarkReached = async () => {
    if (!bus) return;
    const currentIdx = bus.current_stop_index ?? 0;
    const reachedStop = stops.find((s) => s.stop_order === currentIdx);
    const now = new Date();
    let delayMinutes = null;
    if (reachedStop?.scheduled_time) {
      const [h, m] = reachedStop.scheduled_time.split(":").map(Number);
      delayMinutes = now.getHours() * 60 + now.getMinutes() - (h * 60 + m);
    }
    const nextIndex = currentIdx + 1;
    const actualTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Snapshot previous state for potential rollback
    const prevBus = { ...bus };
    const prevReachedStop = reachedStop ? { ...reachedStop } : null;

    // Optimistic local update — reflect immediately, revert on API failure
    setBus({ ...bus, current_stop_index: nextIndex, last_delay_minutes: delayMinutes });
    if (reachedStop) {
      setStops((prev) =>
        prev.map((s) => (s.id === reachedStop.id ? { ...s, actual_arrival: actualTime } : s))
      );
    }

    try {
      await db.entities.Bus.update(bus.id, {
        current_stop_index: nextIndex,
        last_delay_minutes: delayMinutes,
      });
      if (reachedStop) {
        await db.entities.Stop.update(reachedStop.id, { actual_arrival: actualTime });
      }

      // Auto-alert parents on delay > 10 min (morning trip only)
      const isToSchool = (bus.trip_direction || "to_school") === "to_school";
      if (
        isToSchool &&
        delayMinutes !== null &&
        delayMinutes > 10 &&
        !delayAlertSent.current
      ) {
        delayAlertSent.current = true;
        await db.entities.Broadcast.create({
          sender_name: "System",
          sender_role: "driver",
          school_name: bus.school_name,
          title: "Bus Delayed",
          message: `Bus #${bus.bus_number} is running ${delayMinutes} minutes late. Your child may arrive at school later than scheduled.`,
          audience: "bus_specific",
          target_bus_id: bus.id,
          target_bus_number: bus.bus_number,
          priority: "urgent",
        });
      }

      // Auto-alert parents when bus arrives at school (route complete, morning trip)
      if (isToSchool && nextIndex >= stops.length) {
        await db.entities.Broadcast.create({
          sender_name: "System",
          sender_role: "driver",
          school_name: bus.school_name,
          title: "Arrived at School",
          message: `Bus #${bus.bus_number} has arrived at school. All students have been dropped off safely.`,
          audience: "bus_specific",
          target_bus_id: bus.id,
          target_bus_number: bus.bus_number,
          priority: "normal",
        });
      }

      toast({ title: `Stop ${nextIndex} marked as reached` });
    } catch (e) {
      // Revert optimistic update on API rejection
      setBus(prevBus);
      if (prevReachedStop) {
        setStops((prev) =>
          prev.map((s) => (s.id === prevReachedStop.id ? prevReachedStop : s))
        );
      }
      toast({ title: "Failed to mark stop as reached", variant: "destructive" });
    }
  };

  const handleToggleRoute = async () => {
    if (!bus) return;
    const isStarting = bus.status !== "on_route";
    const updates = { status: isStarting ? "on_route" : "active" };
    if (isStarting) {
      updates.route_start_time = new Date().toISOString();
      updates.current_stop_index = 0;
      updates.last_delay_minutes = null;
      updates.trip_direction = tripDirection;
      delayAlertSent.current = false;
    } else {
      updates.route_end_time = new Date().toISOString();
      updates.active_driver_id = "";
      updates.active_driver_type = "";
      updates.claim_start_time = "";
    }
    await db.entities.Bus.update(bus.id, updates);
    setBus({ ...bus, ...updates });
  };

  const handleReportIssue = async () => {
    if (!issueDesc.trim()) return;
    await db.entities.SafetyIssue.create({
      bus_id: user.bus_id,
      driver_name: user.full_name || user.email,
      issue_type: issueType,
      description: issueDesc.trim(),
      stop_index: bus.current_stop_index ?? 0,
    });
    setIssueDesc("");
    setIssueType("delay");
    setShowIssueForm(false);
    toast({ title: "Issue reported to administration" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-800 border-t-slate-800 dark:border-t-slate-200 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user?.bus_id) {
    return <Navigate to="/driver-code" replace />;
  }

  if (!bus) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-800 border-t-slate-800 dark:border-t-slate-200 rounded-full animate-spin" />
      </div>
    );
  }

  const currentIndex = bus.current_stop_index ?? 0;
  const nextStop = stops.find((s) => s.stop_order === currentIndex);
  const routeComplete = currentIndex >= stops.length;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] lg:h-screen">
      <Header
        user={user}
        title={`Bus #${bus.bus_number} — ${bus.school_name}`}
        subtitle="Driver Navigation"
      />
      <ScheduleExceptionBanner schoolName={user.school_name} busId={user.bus_id} />
      <div ref={scrollRef} className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        {(pullDistance > 0 || refreshing) && (
          <div
            className="flex items-center justify-center text-sm text-muted-foreground overflow-hidden"
            style={{ height: refreshing ? 40 : pullDistance }}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : pullDistance > 60 ? "Release to refresh" : "Pull to refresh"}
          </div>
        )}
        {/* Left panel */}
        <div className="lg:w-[360px] lg:border-r border-b lg:border-b-0 lg:overflow-y-auto bg-white dark:bg-slate-950 shrink-0">
          {/* Route controls */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  bus.status === "on_route" ? "bg-green-500 animate-pulse" : "bg-slate-400"
                }`}
              />
              <span className="text-sm font-medium">
                {bus.status === "on_route" ? "On Route" : "Not Started"}
              </span>
              {bus.active_driver_type === "sub" && isClaimActive(bus) && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                  Sub Driver
                </span>
              )}
            </div>
            {bus.status !== "on_route" && (
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setTripDirection("to_school")}
                  className={`flex-1 h-11 rounded-lg text-xs font-medium border transition-colors touch-none ${
                    tripDirection === "to_school"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-slate-950 text-muted-foreground border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  To School
                </button>
                <button
                  onClick={() => setTripDirection("from_school")}
                  className={`flex-1 h-11 rounded-lg text-xs font-medium border transition-colors touch-none ${
                    tripDirection === "from_school"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-slate-950 text-muted-foreground border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  From School
                </button>
              </div>
            )}
            <Button
              onClick={handleToggleRoute}
              variant={bus.status === "on_route" ? "destructive" : "default"}
              className="w-full"
            >
              {bus.status === "on_route" ? (
                <>
                  <Square className="w-4 h-4" /> End Route
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> Start Route
                </>
              )}
            </Button>
          </div>

          {/* Next stop */}
          {!routeComplete && nextStop && (
            <div className="p-4 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">NEXT STOP</p>
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-bold text-lg">{nextStop.name}</p>
                  {bus.last_delay_minutes != null && (
                    <DelayBadge delayMinutes={bus.last_delay_minutes} />
                  )}
                </div>
                {nextStop.address && (
                  <p className="text-sm text-muted-foreground">{nextStop.address}</p>
                )}
                {nextStop.scheduled_time && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Scheduled: {nextStop.scheduled_time}
                  </p>
                )}
                <div className="flex gap-2 mt-4">
                  <Button
                    className="flex-1 h-11"
                    onClick={() =>
                      window.open(
                        `https://www.google.com/maps/dir/?api=1&destination=${nextStop.latitude},${nextStop.longitude}`,
                        "_blank"
                      )
                    }
                  >
                    <Navigation className="w-4 h-4" /> Navigate
                  </Button>
                  <Button size="lg" className="flex-1 h-11" onClick={handleMarkReached}>
                    <Flag className="w-4 h-4" /> Arrived
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Quick alerts (hands-free) */}
          <div className="p-4 border-t">
            <DriverBroadcast user={user} bus={bus} />
          </div>

          {/* All stops */}
          <div className="p-4 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              ALL STOPS ({stops.length})
            </p>
            <div className="space-y-1.5">
              {stops.map((stop) => {
                const isCurrent = stop.stop_order === currentIndex;
                const isPassed = stop.stop_order < currentIndex;
                return (
                  <div key={stop.id} className="flex items-center gap-2 text-sm">
                    <span
                      className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0 ${
                        isCurrent
                          ? "bg-teal-600 text-white"
                          : isPassed
                          ? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                          : "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                      }`}
                    >
                      {stop.stop_order}
                    </span>
                    <span
                      className={`truncate ${
                        isPassed
                          ? "text-muted-foreground line-through"
                          : isCurrent
                          ? "font-medium"
                          : ""
                      }`}
                    >
                      {stop.name}
                    </span>
                    {stop.scheduled_time && (
                      <span className="text-xs text-muted-foreground ml-auto font-mono">
                        {stop.scheduled_time}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Report safety issue */}
          <div className="p-4 border-t">
            {!showIssueForm ? (
              <button
                onClick={() => setShowIssueForm(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-amber-600 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Report a safety issue
              </button>
            ) : (
              <div className="space-y-2 p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/50">
                <p className="text-xs font-medium text-muted-foreground">ISSUE TYPE</p>
                <MobileSelect
                  value={issueType}
                  onChange={(val) => setIssueType(val)}
                  options={[
                    { value: "delay", label: "Delay" },
                    { value: "traffic", label: "Traffic" },
                    { value: "mechanical", label: "Mechanical" },
                    { value: "safety", label: "Safety Concern" },
                    { value: "other", label: "Other" },
                  ]}
                />
                <textarea
                  placeholder="Describe the issue…"
                  value={issueDesc}
                  onChange={(e) => setIssueDesc(e.target.value)}
                  className="w-full min-h-[80px] px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none"
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowIssueForm(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" className="flex-1" onClick={handleReportIssue} disabled={!issueDesc.trim()}>
                    Submit
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Admin alerts */}
          <div className="p-4 border-t">
            <BroadcastFeed schoolName={user.school_name} role="driver" busId={user.bus_id} />
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 min-h-[300px] lg:min-h-0">
          <BusMap
            buses={[bus]}
            stops={stops}
            userLocation={userLocation}
            currentStopIndex={bus.current_stop_index ?? 0}
            follow={user?.map_follow !== false}
            mapType={user?.map_type || "street"}
            zoom={14}
          />
        </div>
      </div>
    </div>
  );
}