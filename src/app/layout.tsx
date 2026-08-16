import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "0GGULL | 인생 큰 결정 전, 숫자로 먼저 따져보기",
  description:
    "반려동물, 자동차, 내 집 마련, 자녀 양육 — 인생의 빅 이벤트 비용과 기회비용을 숫자로 시뮬레이션합니다.",
  keywords: ["기회비용", "생애비용", "계산기", "반려동물", "자동차", "아파트", "양육비", "투자"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('0ggull-theme');var d=window.matchMedia('(prefers-color-scheme:dark)').matches;if(t==='dark'||(!t&&d))document.documentElement.classList.add('dark')})()`,
          }}
        />
      </head>
      <body
        className="min-h-screen antialiased"
        style={{ fontFamily: "'Noto Sans KR', -apple-system, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
