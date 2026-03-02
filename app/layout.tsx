import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "AIS Sales Analytics",
  description: "Sales analytics dashboard for AADINATH INDUSTRIES",
  viewport: "width=device-width, initial-scale=1.0, maximum-scale=5.0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar />
          <main style={{ flex: 1, padding: "var(--main-padding)", minWidth: 0, overflow: "hidden" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
