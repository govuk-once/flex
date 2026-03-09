import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UDP Demo",
  description: "User Data Platform demo app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
