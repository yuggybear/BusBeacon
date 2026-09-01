const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { Bus, LogOut, Crown, ShieldCheck } from "lucide-react";
import { NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";

function navLinks(role) {
  const dashboardPath =
    role === "admin" ? "/admin" : role === "driver" ? "/driver" : "/parent";
  const links = [
    { label: "Home", path: "/" },
    { label: "Dashboard", path: dashboardPath },
    { label: "Schedule", path: "/route-schedule" },
  ];
  if (role === "admin") {
    links.push({ label: "Buses", path: "/bus-management" });
    links.push({ label: "Safety", path: "/safety-reports" });
    links.push({ label: "Broadcast", path: "/admin-broadcast" });
    links.push({ label: "Roster", path: "/student-roster" });
  }
  links.push({ label: "Settings", path: "/settings" });
  return links;
}

export default function Header({ user, title, subtitle }) {
  const roleLabel = user?.app_role
    ? user.app_role.charAt(0).toUpperCase() + user.app_role.slice(1)
    : "";

  return (
    <header className="flex items-center justify-between px-5 py-3 border-b bg-white/90 backdrop-blur-sm z-20 shrink-0 safe-area-top">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 text-white">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">{title || "BusTrack"}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground leading-tight">{subtitle}</p>
            )}
          </div>
        </div>
        {user?.app_role && (
          <nav className="hidden lg:flex items-center gap-1 ml-2 flex-wrap">
            {navLinks(user.app_role).map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-muted-foreground hover:bg-slate-100"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium leading-tight">
            {user?.full_name || user?.email}
          </p>
          <div className="flex items-center gap-1.5 justify-end">
            <p className="text-xs text-muted-foreground leading-tight">{roleLabel}</p>
            {user?.is_main_admin && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium">
                <Crown className="w-2.5 h-2.5" /> Main Admin
              </span>
            )}
            {user?.app_role === "admin" && user?.admin_verified && !user?.is_main_admin && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">
                <ShieldCheck className="w-2.5 h-2.5" /> Verified
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => db.auth.logout("/login")}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}