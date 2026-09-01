const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect, useRef } from "react";
import { MapPin, Clock, ListOrdered, Users } from "lucide-react";

import Header from "@/components/Header";
import BusMap from "@/components/BusMap";
import ParentBusSelector from "@/components/ParentBusSelector";
import ParentChat from "@/components/ParentChat";
import MobileSelect from "@/components/MobileSelect";
import ScheduleExceptionBanner from "@/components/ScheduleExceptionBanner";
import { useToast } from "@/components/ui/use-toast";
import { haversineDistance, estimateETA, formatETA, getStopDelayMinutes } from "@/lib/busUtils";
import DelayBadge from "@/components/DelayBadge";
import BroadcastFeed from "@/components/BroadcastFeed";

export default function ParentDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState([]);
  const [selectedLinkId, setSelectedLinkId] = useState(null);
  const [bus, setBus] = useState(null);
  const [stops, setStops] = useState([]);
  const { toast } = useToast();
  const prevStopIndex = useRef(null);
  const notifiedOneStopAway = useRef(false);
  const notifiedArrived = useRef(false);
  const notifiedProximity = useRef(false);

  // Request browser notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Load user + parent links
  useEffect(() => {
    db.auth
      .me()
      .then(async (u) => {
        setUser(u);
        if (u.school_name) {
          const allLinks = await db.entities.ParentLink.filter({
            school_name: u.school_name,
          });
          const myLinks = allLinks.filter((l) => l.created_by_id === u.id);
          setLinks(myLinks);
          if (myLinks.length > 0) setSelectedLinkId(myLinks[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Determine active student
  const activeLink = links.find((l) => l.id === selectedLinkId) || links[0];
  const activeBusId = activeLink?.bus_id || user?.bus_id;
  const activeStopId = activeLink?.stop_id || user?.stop_id;
  const activeChildName = activeLink?.student_name || user?.child_name;
  const proximityRadius = user?.proximity_radius ?? 0.5;

  // Load bus + stops when activeBusId changes
  useEffect(() => {
    if (!activeBusId) {
      setBus(null);
      setStops([]);
      return;
    }
    db.entities.Bus
      .get(activeBusId)
      .then(async (busData) => {
        setBus(busData);
        const stopData = await db.entities.Stop.filter({ bus_id: activeBusId });
        setStops(stopData.sort((a, b) => a.stop_order - b.stop_order));
      })
      .catch(() => {});
  }, [activeBusId]);

  // Subscribe to bus updates
  useEffect(() => {
    if (!activeBusId) return;
    const unsub = db.entities.Bus.subscribe((event) => {
      if (event.type === "update" && event.data.id === activeBusId) {
        setBus(event.data);
      }
    });
    return unsub;
  }, [activeBusId]);

  // Notify parent when bus is 1 stop away or has arrived at their stop
  useEffect(() => {
    if (!bus || !stops.length || !activeStopId) return;
    const parentStop = stops.find((s) => s.id === activeStopId);
    if (!parentStop) return;

    const currentIndex = bus.current_stop_index ?? 0;
    const prevIndex = prevStopIndex.current;
    prevStopIndex.current = currentIndex;

    const oneAway = parentStop.stop_order - 1;
    const arrived = parentStop.stop_order;

    if (currentIndex < oneAway) notifiedOneStopAway.current = false;
    if (currentIndex < arrived) notifiedArrived.current = false;

    if (prevIndex === null) return;

    if (
      currentIndex === oneAway &&
      !notifiedOneStopAway.current &&
      user?.notify_approaching !== false
    ) {
      notifiedOneStopAway.current = true;
      const msg = "🚌 Your bus is 1 stop away — get ready!";
      toast({ title: "Bus Approaching", description: msg });
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Bus Approaching", { body: msg });
      }
    }

    if (
      currentIndex === arrived &&
      !notifiedArrived.current &&
      user?.notify_arrived !== false
    ) {
      notifiedArrived.current = true;
      const msg = "🎉 Your bus has arrived at your stop!";
      toast({ title: "Bus Arrived", description: msg });
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Bus Arrived", { body: msg });
      }
    }
  }, [bus?.current_stop_index, stops, activeStopId]);

  // Proximity alert — fire when bus physically comes within radius of parent's stop
  useEffect(() => {
    if (!bus?.current_lat || !bus?.current_lng || !activeStopId) return;
    const pStop = stops.find((s) => s.id === activeStopId);
    if (!pStop) return;
    const dist = haversineDistance(
      bus.current_lat,
      bus.current_lng,
      pStop.latitude,
      pStop.longitude
    );
    if (
      dist <= proximityRadius &&
      !notifiedProximity.current &&
      user?.notify_proximity !== false
    ) {
      notifiedProximity.current = true;
      const msg = "📍 Your bus is very close to your stop!";
      toast({ title: "Proximity Alert", description: msg });
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Proximity Alert", { body: msg });
      }
    } else if (dist > proximityRadius * 2) {
      notifiedProximity.current = false;
    }
  }, [bus?.current_lat, bus?.current_lng, stops, activeStopId, proximityRadius]);

  const handleSaved = async (updatedUser) => {
    setUser(updatedUser);
    const allLinks = await db.entities.ParentLink.filter({
      school_name: updatedUser.school_name,
    });
    const myLinks = allLinks.filter((l) => l.created_by_id === updatedUser.id);
    setLinks(myLinks);
    if (myLinks.length > 0) setSelectedLinkId(myLinks[0].id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!activeBusId) {
    return <ParentBusSelector user={user} onSaved={handleSaved} />;
  }

  if (!bus) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  const parentStop = stops.find((s) => s.id === activeStopId);
  const currentIndex = bus.current_stop_index ?? 0;
  const stopsLeft = parentStop
    ? Math.max(0, parentStop.stop_order - currentIndex)
    : 0;

  let etaMinutes = 0;
  if (bus.current_lat && bus.current_lng && parentStop) {
    const dist = haversineDistance(
      bus.current_lat,
      bus.current_lng,
      parentStop.latitude,
      parentStop.longitude
    );
    etaMinutes = estimateETA(dist);
  }

  const stopDelay = getStopDelayMinutes(parentStop?.scheduled_time, etaMinutes);

  const busPassed = parentStop && currentIndex > parentStop.stop_order;
  const busAtStop = parentStop && currentIndex === parentStop.stop_order;

  return (
    <div className="flex flex-col h-screen">
      <Header
        user={user}
        title={`Bus #${bus.bus_number}`}
        subtitle={activeChildName ? `Tracking ${activeChildName}` : "Parent Dashboard"}
      />
      <ScheduleExceptionBanner schoolName={user.school_name} busId={activeBusId} />
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        {/* Info panel */}
        <div className="lg:w-[320px] lg:border-r border-b lg:border-b-0 lg:overflow-y-auto bg-white p-4 space-y-3 shrink-0">
          {/* Student selector */}
          {links.length > 1 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                <Users className="w-3 h-3" /> STUDENT
              </label>
              <MobileSelect
                value={selectedLinkId || ""}
                onChange={(val) => setSelectedLinkId(val)}
                options={links.map((l) => ({
                  value: l.id,
                  label: l.student_name,
                }))}
                className="w-full font-medium"
              />
            </div>
          )}
          <BroadcastFeed schoolName={user.school_name} role="parent" busId={activeBusId} />
          {/* Status card */}
          <div
            className={`p-4 rounded-2xl border ${
              busAtStop
                ? "bg-teal-50 border-teal-300"
                : busPassed
                ? "bg-slate-50 border-slate-200"
                : "bg-blue-50 border-blue-200"
            }`}
          >
            <p className="text-xs font-medium text-muted-foreground mb-1">BUS STATUS</p>
            <p className="font-bold text-lg">
              {busAtStop
                ? "At your stop!"
                : busPassed
                ? "Bus has passed"
                : bus.status === "on_route"
                ? "On the way"
                : "Not started"}
            </p>
            {parentStop && (
              <p className="text-sm text-muted-foreground mt-1">
                Your stop: {parentStop.name} (Stop {parentStop.stop_order})
              </p>
            )}
            {parentStop?.scheduled_time && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground">
                  Scheduled: {parentStop.scheduled_time}
                </span>
                {bus.status === "on_route" && (
                  <DelayBadge delayMinutes={stopDelay} />
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-xl bg-white border">
              <ListOrdered className="w-4 h-4 text-blue-600 mb-1" />
              <p className="text-2xl font-bold">{stopsLeft}</p>
              <p className="text-xs text-muted-foreground">Stops left</p>
            </div>
            <div className="p-3 rounded-xl bg-white border">
              <Clock className="w-4 h-4 text-blue-600 mb-1" />
              <p className="text-2xl font-bold">
                {bus.status === "on_route" ? formatETA(etaMinutes) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">ETA</p>
            </div>
          </div>

          {/* Stop list */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">ROUTE STOPS</p>
            <div className="space-y-1">
              {stops.map((stop) => {
                const isPassed = stop.stop_order < currentIndex;
                const isCurrent = stop.stop_order === currentIndex;
                const isParent = stop.id === activeStopId;
                return (
                  <div
                    key={stop.id}
                    className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                      isParent ? "bg-teal-50 border border-teal-200" : ""
                    }`}
                  >
                    <span
                      className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
                        isPassed
                          ? "bg-green-500 text-white"
                          : isCurrent
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {stop.stop_order}
                    </span>
                    <span
                      className={`truncate ${
                        isPassed ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {stop.name}
                    </span>
                    {isParent && (
                      <MapPin className="w-3.5 h-3.5 text-teal-600 ml-auto shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 min-h-[300px] lg:min-h-0">
          <BusMap
            buses={[bus]}
            stops={stops}
            highlightStopId={activeStopId}
            currentStopIndex={bus.current_stop_index ?? 0}
            follow
            zoom={14}
          />
        </div>

        {/* Chat */}
        <div className="lg:w-[320px] lg:border-l border-t lg:border-t-0 h-[300px] lg:h-auto shrink-0">
          <ParentChat busId={activeBusId} user={user} />
        </div>
      </div>
    </div>
  );
}