const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from "react";
import { Upload, FileText, Loader2, CheckCircle2, X, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    stops: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stop_name: { type: "string" },
          address: { type: "string" },
          latitude: { type: "number" },
          longitude: { type: "number" },
          scheduled_time: { type: "string" },
          students: {
            type: "array",
            items: {
              type: "object",
              properties: {
                first_name: { type: "string" },
                last_name: { type: "string" }
              }
            }
          }
        }
      }
    }
  }
};

export default function RouteImport({ user, selectedBus, onImported }) {
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [creating, setCreating] = useState(false);
  const [fileName, setFileName] = useState("");
  const { toast } = useToast();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedBus) return;
    setFileName(file.name);
    setUploading(true);
    setExtracted(null);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setUploading(false);
      setExtracting(true);

      const isSpreadsheet = /\.(csv|xlsx|xls)$/i.test(file.name);
      let result;

      if (isSpreadsheet) {
        const extracted = await db.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: EXTRACTION_SCHEMA,
        });
        result = extracted.output;

        // Geocode stops that are missing coordinates
        const needsGeocoding = (result?.stops || []).some(
          (s) => !s.latitude || !s.longitude
        );
        if (needsGeocoding && result?.stops?.length) {
          const geocoded = await db.integrations.Core.InvokeLLM({
            prompt: `Geocode these bus stop addresses and return each with its latitude and longitude: ${JSON.stringify(
              result.stops.map((s) => ({ stop_name: s.stop_name, address: s.address }))
            )}`,
            add_context_from_internet: true,
            model: "gemini_3_flash",
            response_json_schema: {
              type: "object",
              properties: {
                locations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      stop_name: { type: "string" },
                      latitude: { type: "number" },
                      longitude: { type: "number" },
                    },
                  },
                },
              },
            },
          });
          const geoMap = {};
          geocoded.locations?.forEach((g) => {
            geoMap[g.stop_name] = g;
          });
          result.stops = result.stops.map((s) => ({
            ...s,
            latitude: s.latitude || geoMap[s.stop_name]?.latitude || 0,
            longitude: s.longitude || geoMap[s.stop_name]?.longitude || 0,
          }));
        }
      } else {
        result = await db.integrations.Core.InvokeLLM({
          prompt:
            "Extract the bus route information from this document. For each stop, extract: the stop name, full street address, scheduled arrival time (if present), and the list of students who get off at that stop (first and last name). Geocode each address to find its latitude and longitude coordinates using web search. Return as structured JSON.",
          file_urls: [file_url],
          add_context_from_internet: true,
          model: "gemini_3_flash",
          response_json_schema: EXTRACTION_SCHEMA,
        });
      }

      setExtracted(result);
    } catch (err) {
      toast({ title: "Failed to process file", variant: "destructive" });
    }
    setExtracting(false);
  };

  const handleCreate = async () => {
    if (!extracted?.stops?.length || !selectedBus) return;
    setCreating(true);
    try {
      const stopRecords = await db.entities.Stop.bulkCreate(
        extracted.stops.map((stop, i) => ({
          bus_id: selectedBus.id,
          name: stop.stop_name || `Stop ${i + 1}`,
          address: stop.address || "",
          latitude: stop.latitude || 0,
          longitude: stop.longitude || 0,
          stop_order: i + 1,
          scheduled_time: stop.scheduled_time || "",
        }))
      );

      const studentLinks = [];
      let studentCount = 0;
      for (let i = 0; i < stopRecords.length; i++) {
        const stopData = extracted.stops[i];
        if (!stopData.students?.length) continue;
        const studentRecords = await db.entities.Student.bulkCreate(
          stopData.students.map((s) => ({
            first_name: s.first_name || "",
            last_name: s.last_name || "",
            bus_id: selectedBus.id,
            school_name: user.school_name,
          }))
        );
        studentCount += studentRecords.length;
        studentLinks.push(
          ...studentRecords.map((sr) => ({
            student_id: sr.id,
            stop_id: stopRecords[i].id,
            bus_id: selectedBus.id,
          }))
        );
      }

      if (studentLinks.length) {
        await db.entities.StudentStop.bulkCreate(studentLinks);
      }

      toast({
        title: `Imported ${stopRecords.length} stops and ${studentCount} students`,
      });
      setExtracted(null);
      setFileName("");
      onImported?.();
    } catch (err) {
      toast({ title: "Failed to create records", variant: "destructive" });
    }
    setCreating(false);
  };

  const handleReset = () => {
    setExtracted(null);
    setFileName("");
  };

  const downloadTemplate = () => {
    const csv =
      "Stop Name,Address,Scheduled Time,Student First Name,Student Last Name\n" +
      "Maple & 3rd,\"123 Maple St, Springfield\",08:15,John,Smith\n" +
      "Maple & 3rd,\"123 Maple St, Springfield\",08:15,Jane,Doe\n" +
      "Oak & 5th,\"456 Oak Ave, Springfield\",08:20,Alice,Johnson\n" +
      "Oak & 5th,\"456 Oak Ave, Springfield\",08:20,Bob,Williams\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bus_route_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const isProcessing = uploading || extracting;
  const totalStudents =
    extracted?.stops?.reduce((sum, s) => sum + (s.students?.length || 0), 0) || 0;

  return (
    <div className="space-y-3 mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-blue-600" />
        <p className="text-xs font-medium text-blue-700">Import Route from Document</p>
      </div>

      {!extracted && !isProcessing && (
        <>
          <p className="text-xs text-muted-foreground">
            Upload a spreadsheet (CSV/Excel) or document (PDF/photo) from the bus
            company. Stops, addresses, and student assignments will be extracted
            automatically and geocoded.
          </p>
          <div className="flex items-center gap-2">
            <label className="flex items-center justify-center gap-2 flex-1 h-10 rounded-lg border-2 border-dashed border-blue-300 bg-white cursor-pointer hover:bg-blue-50 text-sm text-blue-600 font-medium">
              <Upload className="w-4 h-4" /> Choose File
              <input
                type="file"
                accept="image/*,.pdf,.csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFile}
              />
            </label>
            <button
              type="button"
              onClick={downloadTemplate}
              className="flex items-center gap-1 h-10 px-3 rounded-lg border border-blue-300 bg-white text-xs text-blue-600 font-medium hover:bg-blue-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" /> Template
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Spreadsheet columns: Stop Name, Address, Scheduled Time, Student First Name, Student Last Name
          </p>
        </>
      )}

      {isProcessing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {uploading ? `Uploading ${fileName}…` : "Extracting route data…"}
        </div>
      )}

      {extracted && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="font-medium">
              {extracted.stops.length} stops, {totalStudents} students found
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {extracted.stops.map((stop, i) => (
              <div key={i} className="p-2 rounded-lg bg-white border">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span className="font-medium text-sm">{stop.stop_name}</span>
                  {stop.scheduled_time && (
                    <span className="text-xs text-muted-foreground ml-auto font-mono">
                      {stop.scheduled_time}
                    </span>
                  )}
                </div>
                {stop.address && (
                  <p className="text-xs text-muted-foreground mt-1 ml-7">{stop.address}</p>
                )}
                {stop.students?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 ml-7">
                    {stop.students.map((s, j) => (
                      <span
                        key={j}
                        className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
                      >
                        {s.first_name} {s.last_name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Create All
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              disabled={creating}
            >
              <X className="w-4 h-4" /> Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}