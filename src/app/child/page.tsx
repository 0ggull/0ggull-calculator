"use client";

import { useState, useMemo } from "react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Baby, GraduationCap, TrendingUp, Receipt, BookOpen, AlertTriangle } from "lucide-react";
import Header from "@/components/ui/Header";
import TabSelector from "@/components/ui/TabSelector";
import ResultCard from "@/components/ui/ResultCard";
import ReceiptModal from "@/components/ui/ReceiptModal";
import DisclaimerBanner from "@/components/ui/DisclaimerBanner";
import { formatManwon, SP500_RATE, NASDAQ_RATE, INFLATION_RATE } from "@/lib/finance";

// ─── 타입 & 상수 ─────────────────────────────────────────
type EduStyle = "frugal" | "average" | "intensive";

const EDU_TABS = [
  { key: "frugal", label: "알뜰/공교육형", emoji: "📚", subtitle: "사교육 40%↓" },
  { key: "average", label: "일반 평균형", emoji: "🎓", subtitle: "기본값" },
  { key: "intensive", label: "대치동/열성형", emoji: "🏆", subtitle: "교육비 180%↑" },
];

const EDU_MULTIPLIERS: Record<EduStyle, (age: number) => number> = {
  frugal: (age) => (age >= 10 ? 0.6 : 0.8), // 고학년 이후 사교육 40% 감면, 저학년은 20% 감면
  average: () => 1.0,
  intensive: (age) => (age >= 10 ? 1.8 : 1.3), // 고학년 이후 180%, 저학년 130%
};

// 연령별 월평균 비용 (만원) - 일반 평균형 기준
interface AgePhase {
  ageStart: number;
  ageEnd: number;
  label: string;
  monthly: number;       // 만원/월
  oneTimeCost?: number;  // 1회성 비용 (만원)
  govSupport?: number;   // 정부지원 월 감면 (만원)
  description: string;
}

const PHASES: AgePhase[] = [
  {
    ageStart: 0, ageEnd: 0,
    label: "출산·신생아",
    monthly: 50,
    oneTimeCost: 500, // 산후조리원+초기용품
    govSupport: 30,   // 부모급여 70만 중 일부 (순부담 경감)
    description: "산후조리원, 초기용품(유모차·카시트·침대), 분유/기저귀",
  },
  {
    ageStart: 1, ageEnd: 2,
    label: "영아기",
    monthly: 50,
    govSupport: 25, // 부모급여+아동수당
    description: "분유/이유식, 기저귀, 영아복, 소아과, 놀이용품",
  },
  {
    ageStart: 3, ageEnd: 6,
    label: "유아기",
    monthly: 70,
    govSupport: 10, // 아동수당+보육료지원 일부
    description: "어린이집/유치원, 특별활동비, 교구, 의류, 소아과",
  },
  {
    ageStart: 7, ageEnd: 9,
    label: "초등 저학년",
    monthly: 90,
    description: "돌봄, 기초 학원 2~3개, 식비, 의류, 체험학습",
  },
  {
    ageStart: 10, ageEnd: 12,
    label: "초등 고학년",
    monthly: 120,
    description: "주요 교과 학원, 영어학원, 캠프/어학연수, 학용품",
  },
  {
    ageStart: 13, ageEnd: 15,
    label: "중학생",
    monthly: 160,
    description: "본격 입시 학원, 독서실, 용돈, 식비 급증, 교통비",
  },
  {
    ageStart: 16, ageEnd: 18,
    label: "고등학생",
    monthly: 200,
    description: "집중 사교육(과외·학원), 인강, 독서실, 수능 준비",
  },
  {
    ageStart: 19, ageEnd: 22,
    label: "대학생",
    monthly: 167, // 연 2000만 / 12
    description: "등록금 연 800만 + 생활비/주거비 월 100만",
  },
];

// ─── 계산 로직 ───────────────────────────────────────────
interface YearData {
  age: number;
  phase: string;
  costNom: number;     // 명목 비용 (만원)
  costReal: number;    // 인플레 반영
  cumNom: number;
  cumReal: number;
  sp500: number;
  nasdaq: number;
}

interface ChildResult {
  yearly: YearData[];
  totalNom: number;
  totalReal: number;
  sp500Final: number;
  nasdaqFinal: number;
  peakMonthly: number;     // 가장 비싼 시기 월 비용
  peakPhase: string;
  totalGovSupport: number; // 총 정부 지원
}

function calculate(eduStyle: EduStyle): ChildResult {
  const yearly: YearData[] = [];
  let cumNom = 0, cumReal = 0, sp500 = 0, nasdaq = 0;
  const mSP = SP500_RATE / 12, mNQ = NASDAQ_RATE / 12;
  let peakMonthly = 0, peakPhase = "";
  let totalGovSupport = 0;

  for (let age = 0; age <= 22; age++) {
    const phase = PHASES.find((p) => age >= p.ageStart && age <= p.ageEnd)!;
    const mult = EDU_MULTIPLIERS[eduStyle](age);

    let annualCost = phase.monthly * mult * 12;

    // 1회성 비용 (출산 첫 해)
    if (age === phase.ageStart && phase.oneTimeCost) {
      annualCost += phase.oneTimeCost;
    }

    // 정부 지원 차감
    const govMonthly = phase.govSupport || 0;
    const govAnnual = govMonthly * 12;
    annualCost -= govAnnual * (eduStyle === "frugal" ? 1 : 0.7); // 열성형은 정부지원 활용도 낮음
    annualCost = Math.max(annualCost, phase.monthly * mult * 6); // 최소 6개월분은 나감

    totalGovSupport += govAnnual;

    // 인플레이션
    const inflFactor = Math.pow(1 + INFLATION_RATE, age);
    const costReal = annualCost * inflFactor;

    cumNom += annualCost;
    cumReal += costReal;

    // 월 투자
    const monthlyInv = annualCost / 12;
    for (let m = 0; m < 12; m++) {
      sp500 = sp500 * (1 + mSP) + monthlyInv;
      nasdaq = nasdaq * (1 + mNQ) + monthlyInv;
    }

    const effectiveMonthly = annualCost / 12;
    if (effectiveMonthly > peakMonthly) {
      peakMonthly = effectiveMonthly;
      peakPhase = phase.label;
    }

    yearly.push({
      age,
      phase: phase.label,
      costNom: Math.round(annualCost),
      costReal: Math.round(costReal),
      cumNom: Math.round(cumNom),
      cumReal: Math.round(cumReal),
      sp500: Math.round(sp500),
      nasdaq: Math.round(nasdaq),
    });
  }

  return {
    yearly,
    totalNom: Math.round(cumNom),
    totalReal: Math.round(cumReal),
    sp500Final: Math.round(sp500),
    nasdaqFinal: Math.round(nasdaq),
    peakMonthly: Math.round(peakMonthly),
    peakPhase,
    totalGovSupport: Math.round(totalGovSupport),
  };
}

// ─── 컴포넌트 ───────────────────────────────────────────
export default function ChildCalculator() {
  const [eduStyle, setEduStyle] = useState<EduStyle>("average");
  const [showReceipt, setShowReceipt] = useState(false);

  const result = useMemo(() => calculate(eduStyle), [eduStyle]);

  const chartData = result.yearly.map((y) => ({
    name: `${y.age}세`,
    "연간 지출": y.costNom,
    "누적 지출": y.cumNom,
    "S&P500": y.sp500,
    "나스닥": y.nasdaq,
  }));

  const areaData = result.yearly.map((y) => ({
    name: `${y.age}세`,
    "월 지출": Math.round(y.costNom / 12),
    phase: y.phase,
  }));

  return (
    <div className="min-h-screen">
      <Header title="자녀 양육비 시뮬레이터" showBack />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 사교육 성향 */}
        <TabSelector tabs={EDU_TABS} active={eduStyle} onChange={(k) => setEduStyle(k as EduStyle)} />

        {/* 핵심 결과 */}
        <div className="card p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800/50 space-y-2">
          <div className="flex items-center gap-2">
            <Baby className="w-5 h-5 text-amber-500" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">자녀 1명, 대학 졸업까지 드는 총비용</p>
          </div>
          <p className="text-3xl md:text-4xl font-bold text-amber-600 dark:text-amber-400">
            약 {formatManwon(result.totalNom)}
          </p>
          <p className="text-sm text-gray-500">
            물가상승 반영 시 <span className="font-semibold text-orange-600 dark:text-orange-400">{formatManwon(result.totalReal)}</span>
          </p>
        </div>

        {/* 결과 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ResultCard
            icon={<AlertTriangle className="w-5 h-5" />}
            label="가장 비싼 시기"
            value={`월 ${result.peakMonthly.toLocaleString()}만원`}
            sublabel={`${result.peakPhase} 시기 · 사교육 적자 구간`}
            accent="red"
          />
          <ResultCard
            icon={<BookOpen className="w-5 h-5" />}
            label="정부 지원 총액 (0~6세)"
            value={formatManwon(result.totalGovSupport)}
            sublabel="부모급여+아동수당+보육료지원 합산"
            accent="green"
          />
          <ResultCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="S&P500 기회비용 (22년)"
            value={formatManwon(result.sp500Final)}
            sublabel="동일 금액 매월 적립 시 (연 8%)"
            accent="blue"
          />
          <ResultCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="나스닥 기회비용 (22년)"
            value={formatManwon(result.nasdaqFinal)}
            sublabel="동일 금액 매월 적립 시 (연 12%)"
            accent="purple"
          />
        </div>

        {/* 연령별 월 지출 꺾은선 (사교육 적자 구간 시각화) */}
        <div className="card p-5">
          <p className="section-title mb-2">📉 연령별 월 지출 변화</p>
          <p className="text-xs text-gray-500 mb-4">중·고등학교(13~18세) 시기에 가계 현금흐름이 급격히 꺾이는 '사교육 적자 구간'</p>
          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v: number) => `${v}만`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}만원/월`} />
                <ReferenceLine x="13세" stroke="#ef4444" strokeDasharray="3 3" label={{ value: "중학교", fontSize: 10, fill: "#ef4444" }} />
                <ReferenceLine x="16세" stroke="#ef4444" strokeDasharray="3 3" label={{ value: "고등학교", fontSize: 10, fill: "#ef4444" }} />
                <Area type="monotone" dataKey="월 지출" stroke="#f97316" strokeWidth={2} fill="url(#colorCost)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 누적 비교 차트 */}
        <div className="card p-5">
          <p className="section-title mb-4">📈 누적 지출 vs 투자 기회비용</p>
          <div className="h-72 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}억` : `${v}`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatManwon(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="누적 지출" stroke="#f97316" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="S&P500" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="나스닥" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 단계별 상세 */}
        <div className="card p-5 space-y-3">
          <p className="section-title">📋 성장 단계별 비용 상세</p>
          <div className="space-y-2">
            {PHASES.map((phase) => {
              const mult = EDU_MULTIPLIERS[eduStyle](phase.ageStart);
              const monthly = Math.round(phase.monthly * mult);
              const years = phase.ageEnd - phase.ageStart + 1;
              const total = monthly * 12 * years + (phase.oneTimeCost || 0);
              return (
                <div key={phase.label} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {phase.label} ({phase.ageStart}~{phase.ageEnd}세)
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{phase.description}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">월 {monthly}만</p>
                    <p className="text-xs text-gray-400">소계 {formatManwon(total)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 숨은 비용 */}
        <div className="card p-5 space-y-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">💡 자주 간과하는 숨은 비용</p>
          <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>부모 커리어 단절/경력 손실 비용 (주 양육자 기준 연 2,000~4,000만원 상당)</li>
            <li>학군 이동 위한 이사·전세 프리미엄 (강남/목동 +1~3억)</li>
            <li>자녀 결혼자금·전세자금 지원 (5,000만~2억 추가 예상)</li>
            <li>의료비 (교정, 시력교정, 아토피 관리 등 연 100~300만원)</li>
            <li>해외 어학연수/교환학생 (1회 2,000~5,000만원)</li>
            <li>취업 준비 추가 기간 (졸업 후 1~2년 생활비 지원)</li>
            <li>부모 여가·취미 시간 감소 = 삶의 질 기회비용</li>
          </ul>
        </div>

        {/* 영수증 */}
        <button onClick={() => setShowReceipt(true)} className="btn-primary w-full">
          <Receipt className="w-4 h-4" /> SNS 공유용 영수증 보기
        </button>

        <DisclaimerBanner text="비용은 2026년 보건사회연구원·통계청 기반 평균치이며, 지역·가정환경·교육 방침에 따라 크게 달라집니다. 2026년 아동수당 9세 미만 확대, 부모급여(0세 월100만/1세 월50만) 반영." />

        <ReceiptModal
          open={showReceipt}
          onClose={() => setShowReceipt(false)}
          title={`👶 자녀 1명 22년 양육비 (${EDU_TABS.find((t) => t.key === eduStyle)?.label})`}
          footerMessage="이 수억 원의 기회비용보다 아이가 주는 평생의 감동이 더 크다면, 당신은 최고의 부모입니다. 👨‍👩‍👧"
        >
          <div className="space-y-2">
            {PHASES.map((phase) => {
              const mult = EDU_MULTIPLIERS[eduStyle](phase.ageStart);
              const monthly = Math.round(phase.monthly * mult);
              return (
                <div key={phase.label} className="flex justify-between">
                  <span className="truncate">{phase.label} ({phase.ageStart}~{phase.ageEnd}세)</span>
                  <span className="shrink-0 ml-2">월 {monthly}만</span>
                </div>
              );
            })}
            <div className="border-t border-dashed border-gray-300 dark:border-gray-700 pt-2 mt-2">
              <div className="flex justify-between font-bold"><span>총 양육비 (명목)</span><span>{formatManwon(result.totalNom)}</span></div>
              <div className="flex justify-between font-bold"><span>총 양육비 (인플레)</span><span>{formatManwon(result.totalReal)}</span></div>
            </div>
            <div className="border-t border-dashed border-gray-300 dark:border-gray-700 pt-2 mt-2">
              <div className="flex justify-between text-blue-600 dark:text-blue-400"><span>S&P500 기회비용</span><span>{formatManwon(result.sp500Final)}</span></div>
              <div className="flex justify-between text-purple-600 dark:text-purple-400"><span>나스닥 기회비용</span><span>{formatManwon(result.nasdaqFinal)}</span></div>
            </div>
          </div>
        </ReceiptModal>
      </main>
    </div>
  );
}
