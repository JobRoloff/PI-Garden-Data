import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "./ThemeProvider";

export const metadata: Metadata = {
  title: "PI Garden Dashboard",
  description: "MQTT summary and points data from TimescaleDB",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="light">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem("pi-garden-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark"),document.documentElement.classList.remove("light");else document.documentElement.classList.add("light"),document.documentElement.classList.remove("dark");})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
