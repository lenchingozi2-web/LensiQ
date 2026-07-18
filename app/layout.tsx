import "./globals.css";

export const metadata = {
  title: 'LensiqAI',
  description: 'Master medical school with dynamic AI teaching.',
  manifest: '/manifest.json',
  themeColor: '#0B1220',
};

export default function RootLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
