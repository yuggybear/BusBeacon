const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from "react";
import { ShieldCheck, Check, X, UserCog, Crown } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";

export default function AdminVerificationPanel({ schoolName, currentUserId }) {
  const [pending, setPending] = useState([]);
  const [verified, setVerified] = useState([]);
  const [mainAdmin, setMainAdmin] = useState(null);
  const { toast } = useToast();

  const load = async () => {
    const admins = await db.entities.User.filter({
      app_role: "admin",
      school_name: schoolName,
    });
    setPending(admins.filter((a) => !a.admin_verified));
    setVerified(admins.filter((a) => a.admin_verified && !a.is_main_admin));
    setMainAdmin(admins.find((a) => a.is_main_admin));
  };

  useEffect(() => {
    load();
    const unsub = db.entities.User.subscribe((event) => {
      if (event.type === "update" || event.type === "create") load();
    });
    return unsub;
  }, [schoolName]);

  const handleVerify = async (userId) => {
    await db.entities.User.update(userId, { admin_verified: true });
    toast({ title: "Admin verified successfully" });
    load();
  };

  const handleReject = async (admin) => {
    await db.entities.User.update(admin.id, {
      app_role: null,
      school_name: null,
      is_main_admin: false,
      admin_verified: false,
    });
    toast({ title: "Admin request rejected" });
    load();
  };

  const handleTransferMainAdmin = async (newAdminId) => {
    if (mainAdmin) {
      await db.entities.User.update(mainAdmin.id, { is_main_admin: false });
    }
    await db.entities.User.update(newAdminId, {
      is_main_admin: true,
      admin_verified: true,
    });
    toast({ title: "Main admin role transferred" });
    load();
  };

  if (pending.length === 0 && verified.length === 0) return null;

  return (
    <div className="p-4 border-b bg-amber-50/50">
      <div className="flex items-center gap-2 mb-3">
        <UserCog className="w-4 h-4 text-amber-600" />
        <h3 className="font-semibold text-sm">Admin Management</h3>
      </div>

      {/* Main admin */}
      {mainAdmin && (
        <div className="mb-3 p-2 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-2">
          <Crown className="w-4 h-4 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {mainAdmin.full_name || mainAdmin.email}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-blue-600">Main Administrator</p>
              {mainAdmin.admin_document_url && (
                <a
                  href={mainAdmin.admin_document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-600 underline"
                >
                  View docs
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-xs font-medium text-amber-700">
            PENDING VERIFICATION ({pending.length})
          </p>
          {pending.map((admin) => (
            <div
              key={admin.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-white border border-amber-200"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {admin.full_name || admin.email}
                </p>
              </div>
              <button
                onClick={() => handleVerify(admin.id)}
                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50"
                title="Verify"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleReject(admin)}
                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                title="Reject"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Verified */}
      {verified.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-green-700">
            VERIFIED ADMINS ({verified.length})
          </p>
          {verified.map((admin) => (
            <div
              key={admin.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-white border"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-green-600 shrink-0" />
              <p className="text-sm truncate flex-1">
                {admin.full_name || admin.email}
              </p>
              {admin.id !== currentUserId && (
                <>
                  <button
                    onClick={() => handleTransferMainAdmin(admin.id)}
                    className="p-1 rounded text-blue-500 hover:bg-blue-50"
                    title="Make Main Admin"
                  >
                    <Crown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleReject(admin)}
                    className="p-1 rounded text-red-500 hover:bg-red-50"
                    title="Remove admin"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}