import type { Metadata } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import './globals.css';

const sans = DM_Sans({ variable: '--font-ui', subsets: ['latin'] });
const heading = Fraunces({ variable: '--font-display', subsets: ['latin'] });

export const metadata: Metadata = { title: { default: 'LeckerSchmeck | Recipes you can actually follow', template: '%s · LeckerSchmeck' }, description: 'Turn any public recipe into a clear, visual cooking workflow. Scale, convert, edit, cook and share without the clutter.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body className={`${sans.variable} ${heading.variable} antialiased`}>{children}</body></html>; }
