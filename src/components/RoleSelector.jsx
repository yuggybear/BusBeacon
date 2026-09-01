const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from "react";
import { Building2, Bus, Users } from "lucide-react";

import AdminSetup from "@/components/AdminSetup";

export default function RoleSelector({ user, onRoleSelected }) {
  const [saving, setSaving] = useState(null);
  const [showAdminSetup, setShowAdminSetup] = useState(false);

  const roles = [
    { id: "admin", label: "Administrator", desc: "Monitor all buses, manage routes, and generate driver codes", icon: Building2 },
    { id: "driver", label: "Bus Driver", desc: "Navigate your route, share live location, and mark stops", icon: Bus },
    { id: "parent", label: "Parent", desc: "Track your child's bus, see ETA, and chat with other parents", icon: Users },
  ];

  const handleSelect = (role) => {
    if (role === "admin") {
      setShowAdminSetup(true);
      return;
    }
    setSaving(role);
    db.auth
      .updateMe({ app_role: role })
      .then(onRoleSelected)
      .catch((e) => {
        console.error(e);
        setSaving(null);
      });
  };

  if (showAdminSetup) {
    return <AdminSetup user={user} onComplete={onRoleSelected} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white mb-4">
            <Bus className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Welcome to BusTrack</h1>
          <p className="text-muted-foreground mt-2">Choose how you'll use the app to get started</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {roles.map(({ id, label, desc, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleSelect(id)}
              disabled={saving !== null}
              className="group p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all text-left disabled:opacity-50"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg">{label}</h3>
              <p className="text-sm text-muted-foreground mt-1">{desc}</p>
              {saving === id && (
                <p className="text-xs text-blue-600 mt-2">Setting up…</p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}