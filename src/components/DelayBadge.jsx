export default function DelayBadge({ delayMinutes }) {
  if (delayMinutes === null || delayMinutes === undefined) return null;
  if (delayMinutes <= 0) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap">
        On Time
      </span>
    );
  }
  const cls =
    delayMinutes <= 5
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${cls}`}>
      +{delayMinutes}m late
    </span>
  );
}