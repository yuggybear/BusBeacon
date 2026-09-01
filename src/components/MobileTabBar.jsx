const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home as HomeIcon, LayoutDashboard, Settings } from "lucide-react";

const TAB_STATE_KEY = "busbeacon-mobile-tab-state";

const readTabState = () => {
  try {
    const raw = sessionStorage.getItem(TAB_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeTabState = (state) => {
  try {
    sessionStorage.setItem(TAB_STATE_KEY, JSON.stringify(state));
  } catch {
    // no-op for privacy-restricted environments
  }
};

const getContextForPath = (pathname) => {
  if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password")) {
    return "home";
  }

  if (pathname.startsWith("/settings")) {
    return "settings";
  }

  const dashboardPaths = [
    "/admin",
    "/driver",
    "/parent",
    "/route-schedule",
    "/bus-management",
    "/safety-reports",
    "/admin-broadcast",
    "/student-roster",
  ];

  return dashboardPaths.some((base) => pathname === base || pathname.startsWith(`${base}/`)) ? "dashboard" : "home";
};

export default function MobileTabBar() {
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    db.auth
      .me()
      .then(setUser)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const context = getContextForPath(location.pathname);
    const state = readTabState();
    const nextState = { ...state, [context]: location.pathname };
    writeTabState(nextState);
  }, [location.pathname]);

  const dashboardPath = user?.app_role
    ? user.app_role === "admin"
      ? "/admin"
      : user.app_role === "driver"
      ? "/driver"
      : "/parent"
    : "/";

  const getCachedPath = (context, fallback) => {
    const state = readTabState();
    return state[context] || fallback;
  };

  const handleTabClick = (event, tab) => {
    if (tab.to === "/" || tab.to === dashboardPath || tab.to === "/settings") {
      const context = tab.to === "/" ? "home" : tab.to === "/settings" ? "settings" : "dashboard";
      const cached = getCachedPath(context, tab.to);
      if (cached !== tab.to && cached && cached !== location.pathname) {
        event.preventDefault();
        navigate(cached);
      }
    }
  };

  const tabs = [
    { to: "/", label: "Home", icon: HomeIcon, end: true },
    { to: dashboardPath, label: "Dashboard", icon: LayoutDashboard },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white/95 backdrop-blur-md border-t flex items-center justify-around safe-area-bottom touch-none">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          onClick={(event) => handleTabClick(event, tab)}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-2 px-4 text-xs font-medium transition-colors touch-none ${
              isActive ? "text-blue-600" : "text-muted-foreground"
            }`
          }
        >
          <tab.icon className="w-5 h-5" />
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}