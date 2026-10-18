export type Language = "en" | "ru";
export type Status = "confirmed" | "completed" | "cancelled";
export type ServiceId = "discovery" | "review" | "workshop";
export type Booking = {
  id: string;
  name: string;
  email: string;
  service: ServiceId;
  date: string;
  time: string;
  notes: string;
  status: Status;
};
export type Store = { version: 1; bookings: Booking[] };
export type Draft = Omit<Booking, "id" | "status">;
export const services: {
  id: ServiceId;
  duration: number;
  price: number;
  color: string;
}[] = [
  { id: "discovery", duration: 30, price: 45, color: "violet" },
  { id: "review", duration: 60, price: 80, color: "teal" },
  { id: "workshop", duration: 90, price: 120, color: "amber" },
];
export const serviceFor = (id: ServiceId) => services.find((s) => s.id === id)!;
export const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export function parseDay(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}
export function isDate(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(parseDay(day).getTime()) &&
    dateKey(parseDay(day)) === day
  );
}
export function addDays(day: string, amount: number) {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + amount);
  return dateKey(d);
}
export function monday(day: string) {
  const d = parseDay(day);
  return addDays(day, -((d.getUTCDay() + 6) % 7));
}
export const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export const timeLabel = (value: number) =>
  `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
export const startsAt = (booking: Pick<Booking, "date" | "time">) =>
  new Date(`${booking.date}T${booking.time}:00.000Z`).getTime();
export const endsAt = (booking: Booking) =>
  startsAt(booking) + serviceFor(booking.service).duration * 60_000;
export function overlaps(
  a: Pick<Booking, "date" | "time" | "service">,
  b: Pick<Booking, "date" | "time" | "service">,
) {
  return (
    a.date === b.date &&
    minutes(a.time) < minutes(b.time) + serviceFor(b.service).duration &&
    minutes(b.time) < minutes(a.time) + serviceFor(a.service).duration
  );
}
export type ErrorCode =
  | "name"
  | "email"
  | "service"
  | "date"
  | "time"
  | "notes"
  | "past"
  | "closed"
  | "conflict"
  | "missing"
  | "locked"
  | "corrupt"
  | "storage"
  | "busy";
export function validateDraft(
  draft: Draft,
  bookings: Booking[],
  excludeId?: string,
  now = Date.now(),
): ErrorCode | null {
  if (
    typeof draft.name !== "string" ||
    draft.name.trim().length < 2 ||
    draft.name.trim().length > 80
  )
    return "name";
  if (
    typeof draft.email !== "string" ||
    draft.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())
  )
    return "email";
  if (!services.some((s) => s.id === draft.service)) return "service";
  if (!isDate(draft.date)) return "date";
  if (
    !/^\d{2}:(00|30)$/.test(draft.time) ||
    minutes(draft.time) < 540 ||
    minutes(draft.time) + serviceFor(draft.service).duration > 1080
  )
    return "time";
  if (typeof draft.notes !== "string" || draft.notes.length > 500)
    return "notes";
  if (parseDay(draft.date).getUTCDay() === 0) return "closed";
  if (startsAt(draft) <= now) return "past";
  if (
    bookings.some(
      (b) =>
        b.id !== excludeId && b.status !== "cancelled" && overlaps(draft, b),
    )
  )
    return "conflict";
  return null;
}
export function slots(
  day: string,
  service: ServiceId,
  bookings: Booking[],
  excludeId?: string,
  now = Date.now(),
) {
  if (!isDate(day) || parseDay(day).getUTCDay() === 0) return [];
  return Array.from({ length: 18 }, (_, i) => timeLabel(540 + i * 30)).filter(
    (time) =>
      !validateDraft(
        {
          name: "Demo",
          email: "demo@example.com",
          date: day,
          time,
          service,
          notes: "",
        },
        bookings,
        excludeId,
        now,
      ),
  );
}
export function createBooking(
  draft: Draft,
  bookings: Booking[],
  id: string,
  now = Date.now(),
): Booking[] {
  const error = validateDraft(draft, bookings, undefined, now);
  if (error) throw new Error(error);
  if (bookings.some((b) => b.id === id)) throw new Error("conflict");
  return [
    ...bookings,
    {
      ...draft,
      name: draft.name.trim(),
      email: draft.email.trim().toLowerCase(),
      notes: draft.notes.trim(),
      id,
      status: "confirmed",
    },
  ];
}
export function updateBooking(
  id: string,
  draft: Draft,
  bookings: Booking[],
  now = Date.now(),
) {
  const existing = bookings.find((b) => b.id === id);
  if (!existing) throw new Error("missing");
  if (existing.status !== "confirmed" || startsAt(existing) <= now)
    throw new Error("locked");
  const error = validateDraft(draft, bookings, id, now);
  if (error) throw new Error(error);
  return bookings.map((b) =>
    b.id === id
      ? {
          ...b,
          ...draft,
          name: draft.name.trim(),
          email: draft.email.trim().toLowerCase(),
          notes: draft.notes.trim(),
        }
      : b,
  );
}
export function cancelBooking(id: string, bookings: Booking[]) {
  const existing = bookings.find((b) => b.id === id);
  if (!existing) throw new Error("missing");
  if (existing.status !== "confirmed") throw new Error("locked");
  return bookings.map((b) =>
    b.id === id ? { ...b, status: "cancelled" as const } : b,
  );
}
export function completeBooking(
  id: string,
  bookings: Booking[],
  now = Date.now(),
) {
  const existing = bookings.find((b) => b.id === id);
  if (!existing) throw new Error("missing");
  if (existing.status !== "confirmed" || endsAt(existing) > now)
    throw new Error("locked");
  return bookings.map((b) =>
    b.id === id ? { ...b, status: "completed" as const } : b,
  );
}
export function decodeStore(raw: string): Store {
  const value = JSON.parse(raw);
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.bookings) ||
    value.bookings.length > 5000
  )
    throw new Error("corrupt");
  const ids = new Set<string>();
  for (const b of value.bookings) {
    if (
      !b ||
      typeof b.id !== "string" ||
      b.id.length > 100 ||
      ids.has(b.id) ||
      typeof b.name !== "string" ||
      b.name.length < 2 ||
      b.name.length > 80 ||
      typeof b.email !== "string" ||
      b.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) ||
      !services.some((s) => s.id === b.service) ||
      typeof b.date !== "string" ||
      !isDate(b.date) ||
      typeof b.time !== "string" ||
      !/^\d{2}:(00|30)$/.test(b.time) ||
      minutes(b.time) < 540 ||
      minutes(b.time) + serviceFor(b.service).duration > 1080 ||
      parseDay(b.date).getUTCDay() === 0 ||
      typeof b.notes !== "string" ||
      b.notes.length > 500 ||
      !["confirmed", "cancelled", "completed"].includes(b.status)
    )
      throw new Error("corrupt");
    ids.add(b.id);
  }
  for (let i = 0; i < value.bookings.length; i++)
    for (let j = i + 1; j < value.bookings.length; j++) {
      if (
        value.bookings[i].status !== "cancelled" &&
        value.bookings[j].status !== "cancelled" &&
        overlaps(value.bookings[i], value.bookings[j])
      )
        throw new Error("corrupt");
    }
  return value as Store;
}
export function seedBookings(now = new Date()): Booking[] {
  const today = dateKey(now);
  const start = monday(today);
  const names = [
    ["Alex Morgan", "alex@example.com"],
    ["Jamie Park", "jamie@example.com"],
    ["Sam Rivera", "sam@example.com"],
    ["Taylor Chen", "taylor@example.com"],
    ["Jordan Lee", "jordan@example.com"],
    ["Casey Brooks", "casey@example.com"],
  ];
  return [
    [0, "09:30", "discovery", 0],
    [0, "13:00", "review", 1],
    [1, "10:00", "workshop", 2],
    [2, "09:00", "review", 3],
    [2, "14:00", "discovery", 0],
    [3, "11:00", "workshop", 4],
    [4, "09:30", "discovery", 5],
    [4, "14:00", "review", 1],
    [5, "10:00", "review", 2],
  ].map(([offset, time, service, person], i) => {
    const date = addDays(start, Number(offset));
    const [name, email] = names[Number(person)];
    const b: Booking = {
      id: `demo-${start}-${i}`,
      date,
      time: String(time),
      service: service as ServiceId,
      name,
      email,
      notes: "",
      status: "confirmed",
    };
    if (endsAt(b) < now.getTime()) b.status = "completed";
    return b;
  });
}
