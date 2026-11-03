import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Garage",
  description: "Smart Garage gate access and ESP32 monitoring dashboard",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
