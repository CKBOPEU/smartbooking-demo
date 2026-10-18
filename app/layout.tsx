import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SmartBooking — Your day, thoughtfully organised",
  description:
    "A bilingual booking workspace demo with scheduling, client management and conflict-aware rescheduling.",
  robots: { index: false, follow: false },
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
