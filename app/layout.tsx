import "./globals.css";
import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";

const vazirmatn = Vazirmatn({ 
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "بازی مار - نسخه چند مانیتوره",
  description: "بازی مار مدرن که روی چند مانیتور اجرا می‌شود",
  keywords: ["مار", "بازی", "چند مانیتور", "snake", "game"],
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐍</text></svg>" />
      </head>
      <body className={`${vazirmatn.variable} font-vazirmatn antialiased min-h-screen bg-background`}>
        <div className="relative flex min-h-screen flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}







