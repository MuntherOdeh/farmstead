import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: { default: "Farmstead", template: "%s · Farmstead" },
  description: "Private farm operations dashboard",
  robots: { index: false, follow: false },
};

// Applies stored preset/density to <html> before first paint, so a saved
// theme never flashes the default. next-themes injects its own equivalent
// for the light/dark class.
const preferencesScript = `(function(){try{var t=localStorage.getItem("farmstead-preset");if(t&&t!=="default")document.documentElement.setAttribute("data-theme",t);var d=localStorage.getItem("farmstead-density");if(d)document.documentElement.setAttribute("data-density",d)}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased font-sans",
        inter.variable,
        fraunces.variable,
        geistMono.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: preferencesScript }} />
        <AppThemeProvider>
          {children}
          <Toaster />
        </AppThemeProvider>
      </body>
    </html>
  );
}
