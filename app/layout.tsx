import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'LenxiQ AI',
  description: 'Professional medical learning with curriculum pathways, complete past questions, and an AI tutor.',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F6F8FB] text-[#0B1220] antialiased">
        <Navbar />
        <main className="min-h-[calc(100vh-4.5rem)] w-full">{children}</main>
      </body>
    </html>
  );
}
