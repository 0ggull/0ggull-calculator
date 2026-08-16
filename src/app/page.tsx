"use client";

import Link from "next/link";
import { PawPrint, Car, Home, Baby, ArrowRight, Calculator } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";

const CALCULATORS = [
  {
    href: "/pet",
    icon: <PawPrint className="w-7 h-7" />,
    emoji: "🐾",
    title: "반려동물 생애비용",
    description: "소형견/중형견/대형견/고양이 생애 총비용과 투자 기회비용",
    highlight: "평균 5,000만~1.5억원",
    color: "from-amber-500 to-orange-500",
    bgLight: "bg-amber-50",
    bgDark: "dark:bg-amber-950/20",
    borderColor: "border-amber-200 dark:border-amber-800/50",
  },
  {
    href: "/car",
    icon: <Car className="w-7 h-7" />,
    emoji: "🚗",
    title: "자동차 vs 대중교통",
    description: "차량 소유 총비용(할부 이자 포함) vs 택시+대중교통+쏘카 + km당 비교",
    highlight: "감가+유지 월 50~120만원",
    color: "from-sky-500 to-blue-500",
    bgLight: "bg-sky-50",
    bgDark: "dark:bg-sky-950/20",
    borderColor: "border-sky-200 dark:border-sky-800/50",
  },
  {
    href: "/apartment",
    icon: <Home className="w-7 h-7" />,
    emoji: "🏠",
    title: "아파트 매도 손익분기점",
    description: "취득세·이자·복비·양도세 빼고 진짜 본전인 매도가 + 주거비 절약 반영",
    highlight: "산 값 +3~15% 올라야 본전",
    color: "from-emerald-500 to-teal-500",
    bgLight: "bg-emerald-50",
    bgDark: "dark:bg-emerald-950/20",
    borderColor: "border-emerald-200 dark:border-emerald-800/50",
  },
  {
    href: "/child",
    icon: <Baby className="w-7 h-7" />,
    emoji: "👶",
    title: "자녀 22년 양육비",
    description: "출산~독립 연령별 양육비 + 성별(군대) + 지역 + 사교육 성향 시뮬레이션",
    highlight: "남아 26세/여아 22세 독립 기준",
    color: "from-purple-500 to-violet-500",
    bgLight: "bg-purple-50",
    bgDark: "dark:bg-purple-950/20",
    borderColor: "border-purple-200 dark:border-purple-800/50",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800/50">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-brand-500" />
            <span className="font-bold text-lg tracking-tight">
              0<span className="text-brand-500">GGULL</span>
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-10">
        {/* Hero */}
        <section className="text-center space-y-4 animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 tracking-tight leading-tight">
            알면 좀 <span className="text-brand-600 dark:text-brand-400">꿀꿀</span>한<br />
            인생 가격표
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            현실을 보면 좀 꿀꿀하지만, 모르는 것보다 낫잖아.<br className="hidden md:block" />
            인생의 큰 결정 앞에서, 감정 말고 숫자를 먼저 꺼내봅니다.
          </p>
        </section>

        {/* Calculator Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CALCULATORS.map((calc) => (
            <Link
              key={calc.href}
              href={calc.href}
              className={`group relative overflow-hidden rounded-2xl border p-6 transition-all duration-200
                hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]
                ${calc.bgLight} ${calc.bgDark} ${calc.borderColor}`}
            >
              {/* Gradient accent bar */}
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${calc.color}`} />

              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-white/80 dark:bg-gray-900/80 shadow-sm shrink-0">
                  {calc.icon}
                </div>
                <div className="flex-1 space-y-1.5">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {calc.title}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {calc.description}
                  </p>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 bg-white/60 dark:bg-gray-800/60 rounded-lg px-2 py-1 inline-block">
                    {calc.highlight}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-brand-500 transition-colors shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </section>

        {/* Tagline */}
        <section className="text-center space-y-3 pt-4">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            "감정으로 결정하되, 숫자는 알고 결정하자"
          </p>
        </section>

        {/* Disclaimer */}
        <div className="text-center text-[11px] text-gray-400 dark:text-gray-600 leading-relaxed px-4 py-4 border-t border-gray-100 dark:border-gray-800/50">
          모든 계산은 참고용 시뮬레이션이며, 법률·정책·시장은 수시로 변합니다.<br />
          정확한 판단이 필요하면 전문가와 상담하세요. · 무료 · 개인정보 수집 없음
        </div>
      </main>
    </div>
  );
}
