import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { QueryProvider } from "@/components/QueryProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Code Workspace",
  description: "A text-only workspace interface",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Code Workspace"
  }
};

export const viewport: Viewport = {
  themeColor: "#1e1e1e",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
