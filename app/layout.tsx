import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Lensiq AI",
  description: "Elite Medical Study Platform & AI Tutor",manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col">
        {/* This is the Navbar that will now sit at the top of every page */}
        <Navbar />
        
        {/* This is where the rest of your app's pages will load */}
        <main className="flex-grow max-w-4xl mx-auto w-full p-4">
          {children}
        </main>
      </body>
    </html>
  );
}
