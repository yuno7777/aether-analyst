import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css'; // Global styles

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Aether Analyst | AI Research & Analysis',
  description: 'Aether Analyst is a powerful AI agent platform for comprehensive research, data analysis, and intelligent reporting.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased bg-white text-black" suppressHydrationWarning>{children}</body>
    </html>
  );
}
