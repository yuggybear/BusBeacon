import db from '@/api/base44Client';

import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home as HomeIcon, LayoutDashboard, Settings } from "lucide-react";

export default function MobileTabBar() {
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  // Last-visited path per tab — preserves history state when switching tabs
  const [tabHistory, setTabHistory] = useState({});

  useEffect(() => {
    db.auth
      .me()
      .then(setUser)
      .catch(() => {});
  }, []);

  const dashboardPath = user?.app_role
    ? user.app_role === "admin"
      ? "/admin"
      : user.app_role === "driver"
      ? "/driver"
      : user.app_role === "parent"
      ? "/parent"
      : "/"
    : "/";

  const tabs = [
    { key: "home", to: "/", label: "Home", icon: HomeIcon },
    { key: "dashboard", to: dashboardPath, label: "Dashboard", icon: LayoutDashboard },
    { key: "settings", to: "/settings", label: "Settings", icon: Settings },
  ];

  const getTabKey = (pathname) => {
    if (pathname === "/") return "home";
    if (pathname === "/settings") return "settings";
    return "dashboard";
  };

  // Track the last-visited path per tab so switching back restores it
  useEffect(() => {
    const key = getTabKey(location.pathname);
    setTabHistory((prev) =>
      prev[key] === location.pathname ? prev : { ...prev, [key]: location.pathname }
    );
  }, [location.pathname]);

  const handleTabClick = (tab) => {
    if (activeKey === tab.key) {
      // Re-selecting active tab: reset history and navigate to root
      if (location.pathname !== tab.to) {
        setTabHistory((prev) => {
          const next = { ...prev };
          delete next[tab.key];
          return next;
        });
        navigate(tab.to);
      }
    } else {
      const target = tabHistory[tab.key] || tab.to;
      if (location.pathname !== target) {
        navigate(target);
      }
    }
  };

  const activeKey = getTabKey(location.pathname);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t flex items-center justify-around safe-area-bottom touch-none">
      {tabs.map((tab) => {
        const isActive = activeKey === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab)}
            className={`flex flex-col items-center gap-0.5 min-h-[44px] justify-center px-6 text-xs font-medium transition-colors touch-none ${
              isActive ? "text-blue-600" : "text-muted-foreground"
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}