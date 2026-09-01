const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from "react";
import { Building2, ShieldCheck, Clock, Upload, FileCheck, ArrowLeft } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AdminSetup({ user, onComplete }) {
  const [step, setStep] = useState("school");
  const [schoolName, setSchoolName] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSchoolSubmit = async () => {
    if (!schoolName.trim()) return;
    setLoading(true);
    setError("");
    try {
      // Set app_role first so user can query other users (RLS requires admin)
      await db.auth.updateMe({
        app_role: "admin",
        school_name: schoolName.trim(),
      });

      // Check if a main admin already exists for this school
      const existing = await db.entities.User.filter({
        school_name: schoolName.trim(),
        is_main_admin: true,
      });
      const hasMainAdmin = existing.some((u) => u.id !== user.id);

      if (hasMainAdmin) {
        // Subsequent admin — pending verification, no docs needed
        const updated = await db.auth.updateMe({
          is_main_admin: false,
          admin_verified: false,
        });
        onComplete(updated);
      } else {
        // Initial admin — needs to upload documentation
        setStep("document");
      }
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      // Upload the documentation
      const { file_url } = await db.integrations.Core.UploadFile({ file });

      // Set as main admin with documentation on file
      const updated = await db.auth.updateMe({
        is_main_admin: true,
        admin_verified: true,
        admin_document_url: file_url,
      });
      onComplete(updated);
    } catch (e) {
      setError(e.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          {step === "school" && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-4">
                  <Building2 className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold">Administrator Setup</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Enter your school name to get started. The first admin from each school
                  must upload documentation and becomes the main administrator.
                </p>
              </div>
              <div className="space-y-3">
                <Input
                  placeholder="e.g. Riverside Elementary"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="h-11"
                  onKeyDown={(e) => e.key === "Enter" && schoolName.trim() && handleSchoolSubmit()}
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button
                  onClick={handleSchoolSubmit}
                  disabled={loading || !schoolName.trim()}
                  className="w-full h-11"
                  size="lg"
                >
                  {loading ? "Checking…" : "Continue"}
                </Button>
              </div>
              <div className="mt-6 pt-6 border-t space-y-2">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span>If you're the first admin from your school, you'll upload documentation to become the main administrator.</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>If a main admin already exists, you'll need their approval to join — no documentation required.</span>
                </div>
              </div>
            </>
          )}

          {step === "document" && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-4">
                  <FileCheck className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold">Upload Documentation</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  As the first admin for <strong>{schoolName}</strong>, please upload
                  documentation verifying your administrator status (e.g., staff badge,
                  authorization letter, or school-issued ID).
                </p>
              </div>
              <div className="space-y-3">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-400 transition-colors">
                  {file ? (
                    <>
                      <FileCheck className="w-8 h-8 text-green-600 mb-2" />
                      <span className="text-sm font-medium text-slate-700">{file.name}</span>
                      <span className="text-xs text-slate-400 mt-1">Click to change</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="text-sm text-slate-500">Click to upload documentation</span>
                      <span className="text-xs text-slate-400 mt-1">PDF, PNG, JPG, or DOC</span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                </label>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button
                  onClick={handleDocumentSubmit}
                  disabled={loading || !file}
                  className="w-full h-11"
                  size="lg"
                >
                  {loading ? "Uploading…" : "Complete Setup"}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep("school")}
                  disabled={loading}
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}