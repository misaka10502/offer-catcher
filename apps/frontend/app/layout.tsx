import type { Metadata } from 'next';
import { Geist, Space_Grotesk } from 'next/font/google';
import './(default)/css/globals.css';

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  display: 'swap',
});

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Offer 捕手 — 学生求职智能匹配助手',
  description: '海量岗位精准匹配，简历优化一击即中。学生专属 AI 求职助手，帮你找到最适合的工作机会。',
  applicationName: 'Offer 捕手',
  keywords: ['求职', '简历', '岗位匹配', 'AI求职', '学生求职', '简历优化', '校招'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US">
      <body
        className={`${geist.variable} ${spaceGrotesk.variable} antialiased bg-white text-gray-900`}
      >
        <div>{children}</div>
      </body>
    </html>
  );
}
