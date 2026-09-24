import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { DM_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

// Matched to Branding.pdf, whose text is outlined, and accepted by the product
// owner. See docs/design/ui-direction.md before changing either family.
const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "Tenny",
    template: "%s · Tenny",
  },
  description:
    "Verified tennis scores, fair group standings, and a clearer next match.",
  applicationName: "Tenny",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tenny",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b2138" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${schibsted.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        {/*
         * Vercel serves the analytics script from /_vercel/insights, which only
         * exists on Vercel. Rendering it anywhere else 404s and trips the
         * zero-console-errors assertion in tests/e2e/foundation.spec.ts, so it
         * is gated on VERCEL_ENV, which `vercel build` sets and a local or CI
         * `next build` does not.
         */}
        {process.env.VERCEL_ENV ? <Analytics /> : null}
      </body>
    </html>
  );
}
