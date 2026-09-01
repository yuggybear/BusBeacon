const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useEffect, useState, useRef } from "react";
import { Navigate, Link } from "react-router-dom";
import {
  Bus as BusIcon,
  LayoutDashboard,
  Calendar,
  Megaphone,
  Shield,
  Settings,
  MapPin,
  ChevronRight,
  UserCog,
  GraduationCap,
  RefreshCw,
} from "lucide-react";

import Header from "@/components/Header";
import RoleSelector from "@/components/RoleSelector";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

const ROLE_GATES = [
  {
    role: "parent",
    title: "Parent",
    desc: "Track your child's bus in real time with live GPS, arrival alerts, and route chat.",
    icon: GraduationCap,
    bg: "bg-blue-50",
    border: "border-blue-200 hover:border-blue-400",
    iconBg: "bg-blue-600",
  },
  {
    role: "driver",
    title: "Driver",
    desc: "Navigate your route, mark stops as reached, and report issues hands-free.",
    icon: BusIcon,
    bg: "bg-teal-50",
    border: "border-teal-200 hover:border-teal-400",
    iconBg: "bg-teal-600",
  },
  {
    role: "admin",
    title: "Administrator",
    desc: "Manage your school's bus fleet, routes, drivers, and broadcasts.",
    icon: UserCog,
    bg: "bg-purple-50",
    border: "border-purple-200 hover:border-purple-400",
    iconBg: "bg-purple-600",
  },
];

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const { pullDistance, refreshing } = usePullToRefresh(scrollRef, async () => {
    const u = await db.auth.me();
    setUser(u);
  });

  useEffect(() => {
    db.auth
      .me()
      .then((u) => setUser(u))
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

  // ── Gateway for visitors (not logged in) ──
  if (!user) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white">
              <BusIcon className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg">BusTrack</span>
          </div>
          <Link
            to="/login"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Log in
          </Link>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="text-center mb-8 max-w-xl">
            <h1 className="text-3xl font-bold mb-2">
              School bus tracking, simplified.
            </h1>
            <p className="text-muted-foreground">
              Choose how you're using BusTrack to get started. You'll be taken
              to the right login screen.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
            {ROLE_GATES.map((gate) => (
              <Link
                key={gate.role}
                to={`/login?role=${gate.role}`}
                className={`flex flex-col p-6 rounded-2xl ${gate.bg} border ${gate.border} transition-colors group`}
              >
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-xl ${gate.iconBg} text-white mb-4`}
                >
                  <gate.icon className="w-6 h-6" />
                </div>
                <h2 className="font-bold text-lg mb-1">{gate.title}</h2>
                <p className="text-sm text-muted-foreground flex-1">
                  {gate.desc}
                </p>
                <div className="flex items-center gap-1 mt-4 text-sm font-medium text-slate-700 group-hover:gap-2 transition-all">
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </div>
              </Link>
            ))}
          </div>

          <p className="text-sm text-muted-foreground mt-8">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-blue-600 font-medium hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Logged in but no role assigned yet ──
  if (!user.app_role) {
    return <RoleSelector user={user} onRoleSelected={setUser} />;
  }

  // ── Logged in with a role: show landing page with quick access ──
  const role = user.app_role;
  const dashboardPath =
    role === "admin" ? "/admin" : role === "driver" ? "/driver" : "/parent";

  const cards = [
    {
      label: "Dashboard",
      path: dashboardPath,
      icon: LayoutDashboard,
      desc:
        role === "admin"
          ? "Manage buses, stops, and routes"
          : role === "driver"
          ? "Start your route and navigate stops"
          : "Track your bus in real time",
    },
    {
      label: "Schedule",
      path: "/route-schedule",
      icon: Calendar,
      desc: "View scheduled vs actual arrival times",
    },
  ];

  if (role === "admin") {
    cards.push(
      {
        label: "Bus Management",
        path: "/bus-management",
        icon: BusIcon,
        desc: "View and edit bus assignments",
      },
      {
        label: "Route Progress",
        path: "/admin",
        icon: MapPin,
        desc: "Live stop-by-stop route tracking",
      },
      {
        label: "Safety Reports",
        path: "/safety-reports",
        icon: Shield,
        desc: "Review driver-reported issues",
      },
      {
        label: "Broadcast",
        path: "/admin-broadcast",
        icon: Megaphone,
        desc: "Send alerts to parents and drivers",
      }
    );
  }

  cards.push({
    label: "Settings",
    path: "/settings",
    icon: Settings,
    desc: "Manage your preferences",
  });

  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <div className="flex flex-col h-screen">
      <Header user={user} title="BusTrack" subtitle="Home" />
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
        <div className="max-w-3xl mx-auto">
          {(pullDistance > 0 || refreshing) && (
            <div className="flex items-center justify-center py-2" style={{ minHeight: pullDistance }}>
              <RefreshCw className={`w-5 h-5 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
            </div>
          )}
          <div className="mb-6">
            <h1 className="text-2xl font-bold">
              Welcome back, {user.full_name?.split(" ")[0] || "there"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              You're signed in as {roleLabel}. Here's where you can go from here.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cards.map((card) => (
              <Link
                key={card.path + card.label}
                to={card.path}
                className="flex items-center gap-3 p-4 rounded-xl bg-white border hover:bg-slate-50 hover:border-blue-300 transition-colors group"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 text-blue-600 shrink-0">
                  <card.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{card.label}</p>
                  <p className="text-xs text-muted-foreground">{card.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-blue-600 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}