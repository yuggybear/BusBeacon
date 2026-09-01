const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from "react";
import { Bell, Map, Save, Trash2 } from "lucide-react";

import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import ParentStudentManager from "@/components/ParentStudentManager";
import MobileSelect from "@/components/MobileSelect";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export default function SystemSettings() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { toast } = useToast();

  const [notifyProximity, setNotifyProximity] = useState(true);
  const [notifyApproaching, setNotifyApproaching] = useState(true);
  const [notifyArrived, setNotifyArrived] = useState(true);
  const [notifyBroadcasts, setNotifyBroadcasts] = useState(true);
  const [proximityRadius, setProximityRadius] = useState(0.5);
  const [mapType, setMapType] = useState("street");
  const [mapFollow, setMapFollow] = useState(true);

  useEffect(() => {
    db.auth
      .me()
      .then((u) => {
        setUser(u);
        setNotifyProximity(u.notify_proximity !== false);
        setNotifyApproaching(u.notify_approaching !== false);
        setNotifyArrived(u.notify_arrived !== false);
        setNotifyBroadcasts(u.notify_broadcasts !== false);
        setProximityRadius(u.proximity_radius ?? 0.5);
        setMapType(u.map_type || "street");
        setMapFollow(u.map_follow !== false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const updates = {};
    if (user.app_role === "parent") {
      updates.notify_proximity = notifyProximity;
      updates.notify_approaching = notifyApproaching;
      updates.notify_arrived = notifyArrived;
      updates.notify_broadcasts = notifyBroadcasts;
      updates.proximity_radius = proximityRadius;
    } else if (user.app_role === "driver") {
      updates.map_type = mapType;
      updates.map_follow = mapFollow;
    }
    try {
      const updated = await db.auth.updateMe(updates);
      setUser(updated);
      toast({ title: "Settings saved" });
    } catch (e) {
      toast({ title: "Failed to save settings", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await db.functions.invoke("deleteAccount", { userId: user.id });
      toast({ title: "Account deleted" });
      db.auth.logout("/login");
    } catch (e) {
      toast({
        title: "Could not delete account",
        description: "This feature requires a plan upgrade. Please contact support.",
        variant: "destructive",
      });
      setDeleteOpen(false);
    }
    setDeleting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Header user={user} title="Settings" />
      <div className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
        <div className="max-w-lg mx-auto space-y-6">
          <BackButton to="/" className="mb-2" />

          {user.app_role === "parent" && (
            <>
              <ParentStudentManager
                user={user}
                onLinksChanged={() => {
                  db.auth.me().then((u) => setUser(u));
                }}
              />
              <div className="bg-white rounded-xl border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Bell className="w-5 h-5 text-blue-600" />
                  <h2 className="font-bold">Notification Preferences</h2>
                </div>
                <div className="space-y-4">
                  <ToggleRow
                    label="Proximity Alerts"
                    desc="Notify when the bus is within your custom radius"
                    checked={notifyProximity}
                    onChange={setNotifyProximity}
                  />
                  <div className="pl-0">
                    <label className="text-sm font-medium">
                      Proximity Radius: {proximityRadius.toFixed(1)} km
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="2.0"
                      step="0.1"
                      value={proximityRadius}
                      onChange={(e) =>
                        setProximityRadius(parseFloat(e.target.value))
                      }
                      className="w-full mt-2 accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>0.1 km</span>
                      <span>2.0 km</span>
                    </div>
                  </div>
                  <ToggleRow
                    label="One Stop Away"
                    desc="Notify when the bus is 1 stop away"
                    checked={notifyApproaching}
                    onChange={setNotifyApproaching}
                  />
                  <ToggleRow
                    label="Bus Arrived"
                    desc="Notify when the bus reaches your stop"
                    checked={notifyArrived}
                    onChange={setNotifyArrived}
                  />
                  <ToggleRow
                    label="Broadcast Alerts"
                    desc="Notify when the school or driver sends an announcement"
                    checked={notifyBroadcasts}
                    onChange={setNotifyBroadcasts}
                  />
                </div>
              </div>
            </>
          )}

          {user.app_role === "driver" && (
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Map className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold">Navigation Map Settings</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Map Type</label>
                  <MobileSelect
                    value={mapType}
                    onChange={(val) => setMapType(val)}
                    options={[
                      { value: "street", label: "Street View" },
                      { value: "satellite", label: "Satellite View" },
                    ]}
                    className="w-full mt-1"
                  />
                </div>
                <ToggleRow
                  label="Auto-Follow Bus"
                  desc="Automatically recenter the map as the bus moves"
                  checked={mapFollow}
                  onChange={setMapFollow}
                />
              </div>
            </div>
          )}

          {user.app_role === "admin" && (
            <div className="bg-white rounded-xl border p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Administrator settings are managed through Bus Management and the
                dashboard.
              </p>
            </div>
          )}

          {user.app_role !== "admin" && (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-11 touch-none"
              size="lg"
            >
              {saving ? (
                "Saving…"
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Settings
                </>
              )}
            </Button>
          )}

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <button className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl border border-red-200 transition-colors touch-none">
                <Trash2 className="w-4 h-4" /> Delete Account
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action is permanent and cannot be undone. All your data,
                  preferences, and linked students will be removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  {deleting ? "Deleting…" : "Delete Account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 touch-none ${
          checked ? "bg-blue-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}