import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "0GGULL | 알면 꿀꿀한 인생 가격표",
  description:
    "반려동물, 자동차, 내 집 마련, 자녀 양육 — 인생의 큰 결정에 숨겨진 진짜 비용을 계산합니다.",
  keywords: ["기회비용", "생애비용", "계산기", "반려동물", "자동차", "아파트", "양육비", "투자", "0ggull"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="naver-site-verification" content="be9e408bc98007bf999feba9fabef562fde9a9b5" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-QLYP5PQWP9" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-QLYP5PQWP9');`,
          }}
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
