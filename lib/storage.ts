import {
  decodeStore,
  seedBookings,
  type Booking,
  type Store,
} from "./booking.ts";
export const STORAGE_KEY = "smartbooking.demo.v1";
export const LANG_KEY = "smartbooking.language";
export function readBookings(): Booking[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return seedBookings();
  try {
    return decodeStore(raw).bookings;
  } catch {
    throw new Error("corrupt");
  }
}
export async function mutateBookings(
  change: (bookings: Booking[]) => Booking[],
): Promise<Booking[]> {
  const mutate = () => {
    const bookings = change(readBookings());
    const store: Store = { version: 1, bookings };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      throw new Error("storage");
    }
    return bookings;
  };
  if (navigator.locks) return navigator.locks.request(STORAGE_KEY, mutate);
  return mutate();
}
