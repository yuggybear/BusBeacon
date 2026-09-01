const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from "react";
import { Users, Plus, Trash2, Pencil, X, Check } from "lucide-react";

import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import MobileSelect from "@/components/MobileSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export default function StudentRoster() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentStops, setStudentStops] = useState([]);
  const [stops, setStops] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newStopId, setNewStopId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editStopId, setEditStopId] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    db.auth.me()
      .then(async (u) => {
        setUser(u);
        if (u.school_name) {
          const busData = await db.entities.Bus.filter({ school_name: u.school_name });
          setBuses(busData);
          if (busData.length > 0) setSelectedBusId(busData[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedBusId) return;
    loadRoster(selectedBusId);
    const unsub = db.entities.StudentStop.subscribe(() => loadRoster(selectedBusId));
    return unsub;
  }, [selectedBusId]);

  const loadRoster = async (busId) => {
    const [studentData, ssData, stopData] = await Promise.all([
      db.entities.Student.filter({ bus_id: busId }),
      db.entities.StudentStop.filter({ bus_id: busId }),
      db.entities.Stop.filter({ bus_id: busId }),
    ]);
    setStudents(studentData);
    setStudentStops(ssData);
    setStops(stopData.sort((a, b) => a.stop_order - b.stop_order));
  };

  const getStudentStop = (studentId) => {
    const link = studentStops.find((ss) => ss.student_id === studentId);
    return link ? stops.find((s) => s.id === link.stop_id) : null;
  };

  const handleAddStudent = async () => {
    if (!newFirst.trim() || !newLast.trim()) return;
    const student = await db.entities.Student.create({
      first_name: newFirst.trim(),
      last_name: newLast.trim(),
      bus_id: selectedBusId,
      school_name: user.school_name,
    });
    if (newStopId) {
      await db.entities.StudentStop.create({
        student_id: student.id,
        stop_id: newStopId,
        bus_id: selectedBusId,
      });
    }
    setNewFirst("");
    setNewLast("");
    setNewStopId("");
    setShowAdd(false);
    await loadRoster(selectedBusId);
    toast({ title: "Student added to roster" });
  };

  const handleUpdateStop = async (studentId) => {
    const existing = studentStops.find((ss) => ss.student_id === studentId);
    if (existing) {
      await db.entities.StudentStop.update(existing.id, { stop_id: editStopId });
    } else {
      await db.entities.StudentStop.create({
        student_id: studentId,
        stop_id: editStopId,
        bus_id: selectedBusId,
      });
    }
    setEditingId(null);
    setEditStopId("");
    await loadRoster(selectedBusId);
    toast({ title: "Stop assignment updated" });
  };

  const handleRemoveStudent = async (student) => {
    const links = studentStops.filter((ss) => ss.student_id === student.id);
    for (const link of links) {
      await db.entities.StudentStop.delete(link.id);
    }
    await db.entities.Student.delete(student.id);
    await loadRoster(selectedBusId);
    toast({ title: "Student removed from roster" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user.school_name) {
    return (
      <div className="flex flex-col h-screen">
        <Header user={user} title="BusTrack" subtitle="Student Roster" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Please set up your school in the Admin Dashboard first.
          </p>
        </div>
      </div>
    );
  }

  const assignedCount = students.filter((s) => getStudentStop(s.id)).length;
  const unassignedCount = students.length - assignedCount;

  return (
    <div className="flex flex-col h-screen">
      <Header
        user={user}
        title={`BusTrack — ${user.school_name}`}
        subtitle="Student Roster"
      />
      <div className="flex-1 overflow-y-auto bg-slate-50 pb-20 lg:pb-0">
        <div className="max-w-5xl mx-auto p-4 lg:p-6">
          <BackButton to="/admin" className="mb-3" />
          {/* Bus selector + summary */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <MobileSelect
              value={selectedBusId || ""}
              onChange={(val) => setSelectedBusId(val)}
              options={buses.map((bus) => ({
                value: bus.id,
                label: `Bus #${bus.bus_number}`,
              }))}
              className="font-medium"
            />
            <div className="flex gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border text-xs font-medium">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                {students.length} Students
              </span>
              <span className="flex items-center px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-xs font-medium text-green-700">
                {assignedCount} Assigned
              </span>
              {unassignedCount > 0 && (
                <span className="flex items-center px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
                  {unassignedCount} Unassigned
                </span>
              )}
            </div>
            <Button
              size="sm"
              className="sm:ml-auto h-11"
              onClick={() => setShowAdd(!showAdd)}
            >
              <Plus className="w-4 h-4" /> Add Student
            </Button>
          </div>

          {/* Add student form */}
          {showAdd && (
            <div className="bg-white rounded-xl border p-4 mb-4">
              <h3 className="font-semibold text-sm mb-3">Add New Student</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <Input
                  placeholder="First name"
                  value={newFirst}
                  onChange={(e) => setNewFirst(e.target.value)}
                />
                <Input
                  placeholder="Last name"
                  value={newLast}
                  onChange={(e) => setNewLast(e.target.value)}
                />
                <MobileSelect
                  value={newStopId}
                  onChange={(val) => setNewStopId(val)}
                  options={stops.map((stop) => ({
                    value: stop.id,
                    label: `${stop.stop_order}. ${stop.name}`,
                  }))}
                  placeholder="— Assign stop (optional) —"
                />
                <Button size="sm" onClick={handleAddStudent}>Add</Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Only student name and stop assignment are stored — no contact details
                are collected or displayed.
              </p>
            </div>
          )}

          {/* Student table */}
          {buses.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No buses yet. Create a bus in the Admin Dashboard first.
              </p>
            </div>
          ) : students.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No students on this bus yet. Add one manually or import a spreadsheet
                from the Admin Dashboard.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Student Name</th>
                    <th className="px-4 py-2.5 font-medium">Assigned Stop</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const stop = getStudentStop(student.id);
                    const isEditing = editingId === student.id;
                    return (
                      <tr key={student.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">
                          {student.first_name} {student.last_name}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <MobileSelect
                                value={editStopId}
                                onChange={(val) => setEditStopId(val)}
                                options={stops.map((s) => ({
                                  value: s.id,
                                  label: `${s.stop_order}. ${s.name}`,
                                }))}
                                placeholder="— None —"
                              />
                              <button
                                onClick={() => handleUpdateStop(student.id)}
                                className="h-11 w-11 flex items-center justify-center rounded-lg text-green-600 hover:bg-green-50 touch-none"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="h-11 w-11 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-slate-100 touch-none"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : stop ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                                {stop.stop_order}
                              </span>
                              {stop.name}
                            </span>
                          ) : (
                            <span className="text-amber-600 text-xs font-medium">
                              Not assigned
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingId(student.id);
                                setEditStopId(stop?.id || "");
                              }}
                              className="h-11 w-11 flex items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 touch-none"
                              title="Edit stop assignment"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveStudent(student)}
                              className="h-11 w-11 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 touch-none"
                              title="Remove student"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}