import type { Metadata, Viewport } from "next";
import { Inter, Noto_Serif_KR } from "next/font/google";
import "./globals.css";

const sans = Inter({
  variable: "--font-sans-ui",
  subsets: ["latin"],
  display: "swap",
});

const serif = Noto_Serif_KR({
  variable: "--font-serif-book",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Read The Record",
  description: "책에 남기는 목소리",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Read",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f6f1e7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${sans.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
