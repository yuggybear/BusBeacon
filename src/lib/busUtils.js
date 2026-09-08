export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateETA(distanceKm, speedKmh = 25) {
  if (distanceKm < 0.05) return 0;
  return Math.max(1, Math.round((distanceKm / speedKmh) * 60));
}

export function formatETA(minutes) {
  if (minutes <= 0) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function getStopDelayMinutes(scheduledTime, etaMinutes = 0) {
  if (!scheduledTime) return null;
  const parts = scheduledTime.split(":").map(Number);
  if (parts.length < 2 || parts.some(isNaN)) return null;
  const [h, m] = parts;
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() + (etaMinutes || 0) - (h * 60 + m);
}

export const CLAIM_TIMEOUT_HOURS = 10;

export function isClaimActive(bus) {
  if (!bus?.active_driver_id || !bus?.claim_start_time) return false;
  const claimTime = new Date(bus.claim_start_time).getTime();
  if (isNaN(claimTime)) return false;
  const elapsed = Date.now() - claimTime;
  return elapsed < CLAIM_TIMEOUT_HOURS * 60 * 60 * 1000;
}

export function generateBusCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}