import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";
import { ChatWidget } from "@/components/chat/ChatWidget";
import "./globals.css";

const title = "APEX PAY — Save Together, Get Paid In Turn";
const description =
  "APEX PAY is a transparent, contribution-based savings queue. Choose a savings level, contribute once, and get your full contribution back when it's your turn. No guaranteed returns, no hidden fees.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    locale: "en_NG",
    siteName: "APEX PAY",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  themeColor: "#4338ca",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          {children}
          <ChatWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
