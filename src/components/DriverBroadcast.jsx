const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useRef } from "react";
import { Mic, MicOff, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const PRESETS = [
  { label: "Running late", message: "Bus is running approximately 10 minutes late." },
  { label: "Traffic delay", message: "Experiencing traffic delays. Will arrive later than scheduled." },
  { label: "At school", message: "Bus has arrived at school safely." },
  { label: "Bus issue", message: "Bus is experiencing mechanical issues. Alternative transport being arranged." },
];

export default function DriverBroadcast({ user, bus }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [sending, setSending] = useState(false);
  const recognitionRef = useRef(null);
  const { toast } = useToast();

  const sendBroadcast = async (message) => {
    if (!message.trim() || !user?.bus_id) return;
    setSending(true);
    try {
      await db.entities.Broadcast.create({
        sender_name: user.full_name || user.email,
        sender_role: "driver",
        school_name: user.school_name,
        message: message.trim(),
        audience: "bus_specific",
        target_bus_id: user.bus_id,
        target_bus_number: bus?.bus_number,
        priority: "normal",
      });
      toast({ title: "Alert sent to parents" });
    } catch (e) {
      toast({ title: "Failed to send alert", variant: "destructive" });
    }
    setSending(false);
  };

  const handlePreset = (preset) => {
    sendBroadcast(preset.message);
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Voice input not supported on this device" });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
    setTranscript("");
  };

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setListening(false);
  };

  const handleSendVoice = () => {
    sendBroadcast(transcript);
    setTranscript("");
  };

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">QUICK ALERTS (HANDS-FREE)</p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePreset(preset)}
            disabled={sending}
            className="h-12 rounded-xl bg-blue-50 border border-blue-200 text-sm font-medium text-blue-700 hover:bg-blue-100 active:scale-95 transition-all"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {transcript && (
          <div className="p-3 rounded-lg bg-slate-50 border text-sm">{transcript}</div>
        )}
        <div className="flex gap-2">
          {!listening ? (
            <Button
              variant="outline"
              className="flex-1 h-12"
              onClick={startListening}
              disabled={sending}
            >
              <Mic className="w-5 h-5" /> Voice Message
            </Button>
          ) : (
            <Button
              variant="destructive"
              className="flex-1 h-12 animate-pulse"
              onClick={stopListening}
            >
              <MicOff className="w-5 h-5" /> Stop &amp; Save
            </Button>
          )}
          {transcript && (
            <>
              <Button className="h-12 px-4" onClick={handleSendVoice} disabled={sending}>
                <Send className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                className="h-12 px-4"
                onClick={() => setTranscript("")}
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}