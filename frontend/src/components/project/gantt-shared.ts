import { addDays, daysBetween, midnight, toDate } from "@/lib/format";

export interface GanttRange {
  min: Date;
  max: Date;
  totalDays: number;
  months: { label: string; span: number }[];
  weekendOffsets: number[];
  todayOffset: number;
}

export function computeRange(
  starts: (string | null)[],
  ends: (string | null)[],
): GanttRange {
  const inis = starts.map(toDate).filter(Boolean) as Date[];
  const fins = ends.map(toDate).filter(Boolean) as Date[];
  let min = inis.length ? new Date(Math.min(...inis.map((d) => d.getTime()))) : new Date();
  let max = fins.length ? new Date(Math.max(...fins.map((d) => d.getTime()))) : addDays(min, 7);
  min = addDays(midnight(min), -1);
  max = addDays(midnight(max), 2);
  const totalDays = Math.max(daysBetween(min, max) + 1, 1);

  const months: { label: string; span: number }[] = [];
  let cur = new Date(min);
  while (cur <= max) {
    const m = cur.getMonth();
    let c = 0;
    const probe = new Date(cur);
    while (probe <= max && probe.getMonth() === m) {
      c++;
      probe.setDate(probe.getDate() + 1);
    }
    months.push({ label: cur.toLocaleDateString("es-AR", { month: "short", year: "2-digit" }), span: c });
    cur = probe;
  }

  const weekendOffsets: number[] = [];
  const d = new Date(min);
  for (let i = 0; i < totalDays; i++) {
    const wd = d.getDay();
    if (wd === 0 || wd === 6) weekendOffsets.push(i);
    d.setDate(d.getDate() + 1);
  }

  const hoy = midnight(new Date());
  const todayOffset = hoy >= min && hoy <= max ? daysBetween(min, hoy) : -1;

  return { min, max, totalDays, months, weekendOffsets, todayOffset };
}

export function loadWidths() {
  let dayPx = 16, actW = 230;
  try {
    const d = parseInt(localStorage.getItem("ganttDayPx") || "", 10);
    if (d >= 6 && d <= 60) dayPx = d;
    const a = parseInt(localStorage.getItem("ganttActW") || "", 10);
    if (a >= 120 && a <= 600) actW = a;
  } catch { /* sin localStorage */ }
  return { dayPx, actW };
}

export function saveWidths(dayPx: number, actW: number) {
  try {
    localStorage.setItem("ganttDayPx", String(dayPx));
    localStorage.setItem("ganttActW", String(actW));
  } catch { /* sin localStorage */ }
}