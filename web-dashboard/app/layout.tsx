import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IoT Monitor",
  description: "Real-time ESP32 temperature, humidity, and relay dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
