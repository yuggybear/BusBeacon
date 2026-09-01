const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from "react";
import { AlertTriangle, Clock, Flag } from "lucide-react";
import { Navigate } from "react-router-dom";

import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import DelayBadge from "@/components/DelayBadge";

export default function SafetyReports() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buses, setBuses] = useState([]);
  const [issues, setIssues] = useState([]);

  useEffect(() => {
    db.auth
      .me()
      .then(async (u) => {
        setUser(u);
        if (u.app_role === "admin" && u.school_name) {
          const busList = await db.entities.Bus.filter({ school_name: u.school_name });
          setBuses(busList);
          const busIds = busList.map((b) => b.id);
          const allIssues = await db.entities.SafetyIssue.list("-created_date", 100);
          setIssues(allIssues.filter((i) => busIds.includes(i.bus_id)));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

  const getBusNumber = (busId) => {
    const bus = buses.find((b) => b.id === busId);
    return bus ? bus.bus_number : "?";
  };

  const calcDuration = (start, end) => {
    if (!start || !end) return null;
    const mins = Math.round((new Date(end) - new Date(start)) / 60000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  const completedRoutes = buses.filter((b) => b.route_start_time);
  const totalDelay = buses.reduce((sum, b) => sum + (b.last_delay_minutes || 0), 0);

  const issueTypeColors = {
    delay: "bg-amber-100 text-amber-700",
    traffic: "bg-orange-100 text-orange-700",
    mechanical: "bg-red-100 text-red-700",
    safety: "bg-purple-100 text-purple-700",
    other: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="flex flex-col h-screen">
      <Header user={user} title="Safety Reports" subtitle={user.school_name} />
      <div className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <BackButton to="/admin" className="mb-2" />
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-white border">
              <Clock className="w-4 h-4 text-blue-600 mb-1" />
              <p className="text-2xl font-bold">{completedRoutes.length}</p>
              <p className="text-xs text-muted-foreground">Routes Run</p>
            </div>
            <div className="p-4 rounded-xl bg-white border">
              <AlertTriangle className="w-4 h-4 text-amber-600 mb-1" />
              <p className="text-2xl font-bold">{issues.length}</p>
              <p className="text-xs text-muted-foreground">Issues Reported</p>
            </div>
            <div className="p-4 rounded-xl bg-white border">
              <Flag className="w-4 h-4 text-red-600 mb-1" />
              <p className="text-2xl font-bold">{totalDelay}m</p>
              <p className="text-xs text-muted-foreground">Total Delay</p>
            </div>
          </div>

          <div>
            <h2 className="font-bold text-sm mb-3">COMPLETED ROUTES</h2>
            <div className="space-y-2">
              {completedRoutes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 bg-white rounded-xl border">
                  No routes have been run yet.
                </p>
              ) : (
                completedRoutes.map((bus) => (
                  <div key={bus.id} className="bg-white rounded-xl border p-4 flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 text-white shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">Bus #{bus.bus_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(bus.route_start_time).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Duration: {calcDuration(bus.route_start_time, bus.route_end_time) || "In progress"}
                      </p>
                    </div>
                    <DelayBadge delayMinutes={bus.last_delay_minutes} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="font-bold text-sm mb-3">DRIVER-REPORTED ISSUES</h2>
            <div className="space-y-2">
              {issues.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 bg-white rounded-xl border">
                  No issues reported.
                </p>
              ) : (
                issues.map((issue) => (
                  <div key={issue.id} className="bg-white rounded-xl border p-4 flex items-start gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 text-amber-600 shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            issueTypeColors[issue.issue_type] || issueTypeColors.other
                          }`}
                        >
                          {issue.issue_type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Bus #{getBusNumber(issue.bus_id)}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{issue.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {issue.driver_name} • {new Date(issue.created_date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}