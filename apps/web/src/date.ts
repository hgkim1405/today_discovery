export function nextWeekend(now = new Date()): { from: string; to: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const today = new Date(
    Date.UTC(
      Number(part("year")),
      Number(part("month")) - 1,
      Number(part("day")),
    ),
  );
  const weekday = today.getUTCDay();
  const daysToSaturday = weekday === 0 ? -1 : weekday === 6 ? 0 : 6 - weekday;
  const saturday = new Date(today);
  saturday.setUTCDate(today.getUTCDate() + daysToSaturday);
  const sunday = new Date(saturday);
  sunday.setUTCDate(saturday.getUTCDate() + 1);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  return { from: iso(saturday), to: weekday === 0 ? iso(today) : iso(sunday) };
}
