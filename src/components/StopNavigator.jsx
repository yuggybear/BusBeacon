import { Check, Navigation, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function StopNavigator({ stops, bus, onMarkReached }) {
  const sorted = [...stops].sort((a, b) => a.stop_order - b.stop_order);
  const currentIndex = bus?.current_stop_index ?? 0;
  const routeComplete = currentIndex >= sorted.length;

  const handleNavigate = (stop) => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}`,
      "_blank"
    );
  };

  return (
    <div className="space-y-2">
      {sorted.map((stop) => {
        const isPassed = stop.stop_order < currentIndex;
        const isCurrent = stop.stop_order === currentIndex;
        const isNext = stop.stop_order === currentIndex + 1;

        return (
          <div
            key={stop.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border transition-colors",
              isCurrent && "bg-teal-50 border-teal-300",
              isNext && "bg-blue-50 border-blue-300",
              !isCurrent && !isNext && !isPassed && "bg-white",
              isPassed && "bg-slate-50 border-slate-200 opacity-60"
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0",
                isPassed ? "bg-green-500 text-white" : "bg-slate-200 text-slate-700"
              )}
            >
              {isPassed ? <Check className="w-4 h-4" /> : stop.stop_order}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{stop.name}</p>
              {stop.address && (
                <p className="text-xs text-muted-foreground truncate">{stop.address}</p>
              )}
            </div>
            {stop.scheduled_time && (
              <span className="text-xs text-muted-foreground shrink-0 font-mono">
                {stop.scheduled_time}
              </span>
            )}
            {isCurrent && (
              <span className="text-xs font-semibold text-teal-600 px-1">Here</span>
            )}
            {(isCurrent || isNext) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleNavigate(stop)}
                className="shrink-0 h-8 w-8 p-0"
              >
                <Navigation className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        );
      })}
      {routeComplete && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-300 text-green-700">
          <Flag className="w-4 h-4" />
          <span className="text-sm font-medium">Route complete!</span>
        </div>
      )}
    </div>
  );
}