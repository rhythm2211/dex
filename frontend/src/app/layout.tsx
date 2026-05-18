import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import FloatingDock from "@/components/FloatingDock";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DEX",
  description: "Map-first code intelligence: understand any repository at a glance.",
  icons: {
    icon: [
      { url: "/dex-logo.png", sizes: "any" },
      { url: "/dex-logo.png", type: "image/png" },
    ],
    shortcut: "/dex-logo.png",
    apple: "/dex-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Suppress MetaMask errors before React loads
              (function() {
                const isMetaMaskError = function(msg) {
                  if (!msg) return false;
                  const lower = msg.toLowerCase();
                  return lower.includes('metamask') || 
                         lower.includes('failed to connect') ||
                         lower.includes('nkbihfbeogaeaoehlefnkodbefgpgknn') ||
                         lower.includes('inpage.js') ||
                         lower.includes('chrome-extension://');
                };
                
                const originalError = console.error;
                const originalWarn = console.warn;
                
                console.error = function(...args) {
                  const msg = args.join(' ');
                  if (isMetaMaskError(msg)) return;
                  originalError.apply(console, args);
                };
                
                console.warn = function(...args) {
                  const msg = args.join(' ');
                  if (isMetaMaskError(msg)) return;
                  originalWarn.apply(console, args);
                };
                
                window.addEventListener('error', function(e) {
                  if (isMetaMaskError(e.message) || isMetaMaskError(e.filename)) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                  }
                }, true);
                
                window.addEventListener('unhandledrejection', function(e) {
                  const reason = e.reason?.toString() || '';
                  if (isMetaMaskError(reason)) {
                    e.preventDefault();
                    return false;
                  }
                });
              })();
            `,
          }}
        />
      </head>
      <body className={`${geistSans.className} font-sans antialiased`}>
        <Providers>
          {children}
          <FloatingDock />
        </Providers>
      </body>
    </html>
  );
}
