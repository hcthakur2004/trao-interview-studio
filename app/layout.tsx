import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Interview Studio — Prepare with purpose',
  description: 'Turn a job description into a researched, editable interview preparation kit.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
