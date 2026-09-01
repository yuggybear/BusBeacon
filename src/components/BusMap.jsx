import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom ?? map.getZoom());
  }, [center, zoom, map]);
  return null;
}

const busIcon = L.divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#2563eb;color:white;font-size:20px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🚌</div>`,
  className: "",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function makeStopIcon(order, isHighlight, isPassed) {
  const bg = isHighlight ? "#0d9488" : isPassed ? "#94a3b8" : "#2563eb";
  const ring = isHighlight ? "box-shadow:0 0 0 5px rgba(13,148,136,0.3);" : "";
  return L.divIcon({
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:${bg};color:white;font-size:11px;font-weight:700;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);${ring}">${order}</div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export default function BusMap({
  buses = [],
  stops = [],
  highlightStopId,
  userLocation,
  center,
  zoom = 13,
  follow = false,
  currentStopIndex,
  mapType = "street",
}) {
  const sortedStops = [...stops].sort((a, b) => a.stop_order - b.stop_order);
  const routePositions = sortedStops.map((s) => [s.latitude, s.longitude]);

  const busWithLocation = buses.find((b) => b.current_lat && b.current_lng);
  const defaultCenter =
    center ||
    (busWithLocation
      ? [busWithLocation.current_lat, busWithLocation.current_lng]
      : sortedStops.length > 0
      ? [sortedStops[0].latitude, sortedStops[0].longitude]
      : [47.6062, -122.3321]);

  const followCenter =
    follow && busWithLocation
      ? [busWithLocation.current_lat, busWithLocation.current_lng]
      : null;

  return (
    <MapContainer
      center={defaultCenter}
      zoom={zoom}
      className="w-full h-full"
      style={{ minHeight: "300px", zIndex: 0 }}
    >
      <TileLayer
        url={mapType === "satellite" ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
        attribution={mapType === "satellite" ? "Esri" : "&copy; OpenStreetMap"}
      />
      {followCenter && <Recenter center={followCenter} zoom={zoom} />}
      {routePositions.length > 1 && (
        <Polyline
          positions={routePositions}
          pathOptions={{ color: "#0d9488", weight: 3, dashArray: "8 8" }}
        />
      )}
      {buses
        .filter((b) => b.current_lat && b.current_lng)
        .map((bus) => (
          <Marker
            key={bus.id}
            position={[bus.current_lat, bus.current_lng]}
            icon={busIcon}
          >
            <Popup>
              <div>
                <p className="font-semibold">Bus #{bus.bus_number}</p>
                <p className="text-xs text-muted-foreground">{bus.school_name}</p>
                <p className="text-xs mt-1">Status: {bus.status}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      {sortedStops.map((stop) => {
        const isHighlight = stop.id === highlightStopId;
        const isPassed =
          currentStopIndex != null && stop.stop_order < currentStopIndex;
        return (
          <Marker
            key={stop.id}
            position={[stop.latitude, stop.longitude]}
            icon={makeStopIcon(stop.stop_order, isHighlight, isPassed)}
          >
            <Popup>
              <div>
                <p className="font-semibold">Stop {stop.stop_order}: {stop.name}</p>
                {stop.address && (
                  <p className="text-xs text-muted-foreground">{stop.address}</p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
      {userLocation && (
        <CircleMarker
          center={userLocation}
          radius={10}
          pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.4 }}
        />
      )}
    </MapContainer>
  );
}