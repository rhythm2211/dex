import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Suppress MetaMask and Cloudflare Insights errors before React loads
              (function() {
                const shouldSuppressError = function(msg) {
                  if (!msg) return false;
                  const lower = msg.toLowerCase();
                  // MetaMask errors
                  if (lower.includes('metamask') || 
                      lower.includes('failed to connect') ||
                      lower.includes('nkbihfbeogaeaoehlefnkodbefgpgknn') ||
                      lower.includes('inpage.js') ||
                      lower.includes('chrome-extension://')) {
                    return true;
                  }
                  // Cloudflare Insights errors
                  if (lower.includes('cloudflareinsights') ||
                      lower.includes('beacon.min.js') ||
                      lower.includes('static.cloudflareinsights.com') ||
                      lower.includes('no-response') ||
                      lower.includes('fetchevent')) {
                    return true;
                  }
                  return false;
                };
                
                const originalError = console.error;
                const originalWarn = console.warn;
                
                console.error = function(...args) {
                  const msg = args.join(' ');
                  if (shouldSuppressError(msg)) return;
                  originalError.apply(console, args);
                };
                
                console.warn = function(...args) {
                  const msg = args.join(' ');
                  if (shouldSuppressError(msg)) return;
                  originalWarn.apply(console, args);
                };
                
                window.addEventListener('error', function(e) {
                  if (shouldSuppressError(e.message) || shouldSuppressError(e.filename)) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                  }
                }, true);
                
                window.addEventListener('unhandledrejection', function(e) {
                  const reason = e.reason?.toString() || '';
                  if (shouldSuppressError(reason)) {
                    e.preventDefault();
                    return false;
                  }
                });
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
