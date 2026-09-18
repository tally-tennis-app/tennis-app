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
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
