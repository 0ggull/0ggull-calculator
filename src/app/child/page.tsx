"use client";

import { useState, useMemo } from "react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Baby, TrendingUp, Receipt, BookOpen, AlertTriangle, Shield } from "lucide-react";
import Header from "@/components/ui/Header";
import TabSelector from "@/components/ui/TabSelector";
import Slider from "@/components/ui/Slider";
import ResultCard from "@/components/ui/ResultCard";
import ReceiptModal from "@/components/ui/ReceiptModal";
import DisclaimerBanner from "@/components/ui/DisclaimerBanner";
import { formatManwon, SP500_RATE, NASDAQ_RATE } from "@/lib/finance";

// ─── 타입 & 상수 ─────────────────────────────────────────
type EduStyle = "frugal" | "average" | "intensive";
type Gender = "male" | "female";
type Region = "seoul" | "metro" | "local";

const EDU_TABS = [
  { key: "frugal", label: "알뜰/공교육형", emoji: "📚", subtitle: "사교육 40%↓" },
  { key: "average", label: "일반 평균형", emoji: "🎓", subtitle: "기본값" },
  { key: "intensive", label: "대치동/열성형", emoji: "🏆", subtitle: "교육비 180%↑" },
];

const GENDER_TABS = [
  { key: "male", label: "남아", emoji: "👦", subtitle: "군복무 포함" },
  { key: "female", label: "여아", emoji: "👧", subtitle: "22세 졸업" },
];

const REGION_TABS = [
  { key: "seoul", label: "서울/강남", emoji: "🏙️" },
  { key: "metro", label: "수도권", emoji: "🌆" },
  { key: "local", label: "지방", emoji: "🏡" },
];

const REGION_MULTIPLIER: Record<Region, number> = {
  seoul: 1.3,
  metro: 1.0,
  local: 0.75,
};

const EDU_MULTIPLIERS: Record<EduStyle, (age: number) => number> = {
  frugal: (age) => (age >= 10 ? 0.6 : 0.8),
  average: () => 1.0,
  intensive: (age) => (age >= 10 ? 1.8 : 1.3),
};

interface AgePhase {
  ageStart: number;
  ageEnd: number;
  label: string;
  monthly: number;
  oneTimeCost?: number;
  govSupport?: number;
  description: string;
}

const PHASES: AgePhase[] = [
  { ageStart: 0, ageEnd: 0, label: "출산·신생아", monthly: 55, oneTimeCost: 500, govSupport: 100, description: "산후조리원, 초기용품, 분유/기저귀" },
  { ageStart: 1, ageEnd: 1, label: "만 1세", monthly: 50, govSupport: 50, description: "분유/이유식, 기저귀, 영아복, 놀이용품" },
  { ageStart: 2, ageEnd: 2, label: "만 2세", monthly: 55, govSupport: 10, description: "어린이집, 식비, 의류, 소아과" },
  { ageStart: 3, ageEnd: 6, label: "유아기", monthly: 75, govSupport: 10, description: "어린이집/유치원, 특별활동비, 교구" },
  { ageStart: 7, ageEnd: 9, label: "초등 저학년", monthly: 95, description: "돌봄, 기초 학원 2~3개, 체험학습" },
  { ageStart: 10, ageEnd: 12, label: "초등 고학년", monthly: 130, description: "주요 교과 학원, 영어, 캠프" },
  { ageStart: 13, ageEnd: 15, label: "중학생", monthly: 170, description: "입시 학원, 독서실, 용돈 급증" },
  { ageStart: 16, ageEnd: 18, label: "고등학생", monthly: 210, description: "집중 사교육, 과외, 인강, 수능준비" },
  { ageStart: 19, ageEnd: 22, label: "대학생", monthly: 170, description: "등록금 연 850만 + 생활비/주거비" },
  { ageStart: 23, ageEnd: 24, label: "군복무", monthly: 30, description: "용돈·보험·간식비 (군 급여 외 부모 지원)" },
  { ageStart: 25, ageEnd: 26, label: "취준/사회초년", monthly: 80, description: "취업준비, 자격증, 면접복, 생활비 일부 지원" },
];

// ─── 계산 로직 ───────────────────────────────────────────
interface YearData {
  age: number; phase: string; costNom: number; costReal: number;
  cumNom: number; cumReal: number; sp500: number; nasdaq: number;
}
interface ChildResult {
  yearly: YearData[]; totalNom: number; totalReal: number;
  sp500Final: number; nasdaqFinal: number;
  peakMonthly: number; peakPhase: string; totalGovSupport: number;
  endAge: number; monthlyAvg: number;
}

function calculate(eduStyle: EduStyle, gender: Gender, region: Region, uniType: "private" | "national", inflRate: number): ChildResult {
  const regionMult = REGION_MULTIPLIER[region];
  const endAge = gender === "male" ? 26 : 22;
  const yearly: YearData[] = [];
  let cumNom = 0, cumReal = 0, sp500 = 0, nasdaq = 0;
  const mSP = SP500_RATE / 12, mNQ = NASDAQ_RATE / 12;
  let peakMonthly = 0, peakPhase = "";
  let totalGovSupport = 0;

  for (let age = 0; age <= endAge; age++) {
    const phase = PHASES.find((p) => age >= p.ageStart && age <= p.ageEnd);
    if (!phase) continue;

    // 군복무 & 취준은 남아만
    if ((phase.label === "군복무" || phase.label === "취준/사회초년") && gender === "female") continue;

    const eduMult = EDU_MULTIPLIERS[eduStyle](age);
    // 군복무/취준은 교육성향 무관
    const isPostGrad = age >= 23;
    const isUniversity = age >= 19 && age <= 22;
    let mult = isPostGrad ? 1.0 : eduMult * regionMult;

    // 대학생: 국립/사립에 따라 등록금 차이 반영
    let annualCost = phase.monthly * mult * 12;
    if (isUniversity && uniType === "national") {
      // 국립대: 등록금 연 450만 vs 사립 850만 → 월비용 약 33만 감소
      annualCost -= 33 * regionMult * 12;
    }

    if (age === phase.ageStart && phase.oneTimeCost) {
      annualCost += phase.oneTimeCost;
    }

    // 정부 지원
    const govMonthly = phase.govSupport || 0;
    const govAnnual = govMonthly * 12;
    const govUsageRate = eduStyle === "intensive" ? 0.5 : 1.0;
    annualCost -= govAnnual * govUsageRate;
    annualCost = Math.max(annualCost, phase.monthly * mult * 4);

    totalGovSupport += govAnnual;

    const inflFactor = Math.pow(1 + inflRate, age);
    const costReal = annualCost * inflFactor;
    cumNom += annualCost;
    cumReal += costReal;

    // 실제 지출(인플레 반영) 기준으로 투자 적립
    const monthlyInv = costReal / 12;
    for (let m = 0; m < 12; m++) {
      sp500 = sp500 * (1 + mSP) + monthlyInv;
      nasdaq = nasdaq * (1 + mNQ) + monthlyInv;
    }

    const effectiveMonthly = annualCost / 12;
    if (effectiveMonthly > peakMonthly) {
      peakMonthly = effectiveMonthly;
      peakPhase = phase.label;
    }

    yearly.push({ age, phase: phase.label, costNom: Math.round(annualCost), costReal: Math.round(costReal), cumNom: Math.round(cumNom), cumReal: Math.round(cumReal), sp500: Math.round(sp500), nasdaq: Math.round(nasdaq) });
  }

  const monthlyAvg = Math.round(cumNom / yearly.length / 12);

  return {
    yearly, totalNom: Math.round(cumNom), totalReal: Math.round(cumReal),
    sp500Final: Math.round(sp500), nasdaqFinal: Math.round(nasdaq),
    peakMonthly: Math.round(peakMonthly), peakPhase,
    totalGovSupport: Math.round(totalGovSupport), endAge, monthlyAvg,
  };
}

// ─── 컴포넌트 ───────────────────────────────────────────
export default function ChildCalculator() {
  const [eduStyle, setEduStyle] = useState<EduStyle>("average");
  const [gender, setGender] = useState<Gender>("male");
  const [region, setRegion] = useState<Region>("metro");
  const [uniType, setUniType] = useState<"private" | "national">("private");
  const [inflationRate, setInflationRate] = useState(2.5);
  const [showReceipt, setShowReceipt] = useState(false);

  const result = useMemo(() => calculate(eduStyle, gender, region, uniType, inflationRate / 100), [eduStyle, gender, region, uniType, inflationRate]);

  const chartData = result.yearly.map((y) => ({
    name: `${y.age}세`, "누적 지출": y.cumReal, "S&P500": y.sp500, "나스닥": y.nasdaq,
  }));

  const areaData = result.yearly.map((y) => ({
    name: `${y.age}세`, "월 지출": Math.round(y.costNom / 12), phase: y.phase,
  }));

  return (
    <div className="min-h-screen">
      <Header title="자녀 양육비 시뮬레이터" showBack />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* 성별 선택 */}
        <TabSelector tabs={GENDER_TABS} active={gender} onChange={(k) => setGender(k as Gender)} />

        {/* 사교육 성향 */}
        <TabSelector tabs={EDU_TABS} active={eduStyle} onChange={(k) => setEduStyle(k as EduStyle)} />

        {/* 지역 선택 */}
        <TabSelector tabs={REGION_TABS} active={region} onChange={(k) => setRegion(k as Region)} />

        {/* 대학 유형 */}
        <div className="flex gap-2">
          <button onClick={() => setUniType("private")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${uniType === "private" ? "bg-brand-50 dark:bg-brand-900/40 border-brand-300 dark:border-brand-600 text-brand-700 dark:text-brand-200" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"}`}>
            🏫 사립대 (연 850만)
          </button>
          <button onClick={() => setUniType("national")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${uniType === "national" ? "bg-brand-50 dark:bg-brand-900/40 border-brand-300 dark:border-brand-600 text-brand-700 dark:text-brand-200" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"}`}>
            🏛️ 국립대 (연 450만)
          </button>
        </div>

        {/* 물가상승률 */}
        <div className="card p-5">
          <Slider label="물가상승률" value={inflationRate} min={0} max={5} step={0.5} onChange={setInflationRate} formatDisplay={(v) => `연 ${v.toFixed(1)}%`} />
        </div>

        {/* 핵심 결과 */}
        <div className="card p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800/50 space-y-2">
          <div className="flex items-center gap-2">
            <Baby className="w-5 h-5 text-amber-500" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {gender === "male" ? "아들" : "딸"} 1명, {result.endAge}세 독립까지 총비용
            </p>
          </div>
          <p className="text-3xl md:text-4xl font-bold text-amber-600 dark:text-amber-400">약 {formatManwon(result.totalReal)}</p>
          <p className="text-sm text-gray-500">
            현재가치 기준 {formatManwon(result.totalNom)}
            {" · "}월평균 {Math.round(result.totalReal / result.yearly.length / 12)}만원 (물가 연 {inflationRate}%)
          </p>
          <p className="text-xs text-gray-400 pt-1 border-t border-amber-200 dark:border-amber-800/50">
            = {result.endAge}년간 실제 지갑에서 나가는 돈 · 가장 비싼 {result.peakPhase} 시기엔 월 {result.peakMonthly}만원+
          </p>
        </div>

        {/* 군복무 안내 (남아) */}
        {gender === "male" && (
          <div className="card p-4 flex items-start gap-3 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
            <Shield className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">군복무 기간 반영</p>
              <p className="text-xs text-gray-500">만 23~24세 군복무(용돈·보험 월 30만) + 25~26세 취준/사회초년기 생활비 지원 포함. 실질 독립 26세 기준.</p>
            </div>
          </div>
        )}

        {/* 결과 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ResultCard icon={<AlertTriangle className="w-5 h-5" />} label="가장 비싼 시기" value={`월 ${result.peakMonthly.toLocaleString()}만원`} sublabel={`${result.peakPhase} · 사교육 적자 구간`} accent="red" />
          <ResultCard icon={<BookOpen className="w-5 h-5" />} label="정부 지원 총액 (0~6세)" value={formatManwon(result.totalGovSupport)} sublabel="부모급여+아동수당+보육료 합산" accent="green" />
          <ResultCard icon={<TrendingUp className="w-5 h-5" />} label={`S&P500 기회비용 (${result.endAge}년)`} value={formatManwon(result.sp500Final)} sublabel="동일 금액 매월 적립 (연 8%)" accent="blue" />
          <ResultCard icon={<TrendingUp className="w-5 h-5" />} label={`나스닥 기회비용 (${result.endAge}년)`} value={formatManwon(result.nasdaqFinal)} sublabel="동일 금액 매월 적립 (연 12%)" accent="purple" />
        </div>

        {/* 연령별 월 지출 */}
        <div className="card p-5">
          <p className="section-title mb-2">📉 연령별 월 지출 변화</p>
          <p className="text-xs text-gray-500 mb-4">중·고등학교(13~18세) 시기 사교육 적자 구간 시각화</p>
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
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tickFormatter={(v: number) => `${v}만`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}만원/월`} />
                <ReferenceLine x="13세" stroke="#ef4444" strokeDasharray="3 3" label={{ value: "중학교", fontSize: 10, fill: "#ef4444" }} />
                <ReferenceLine x="16세" stroke="#ef4444" strokeDasharray="3 3" label={{ value: "고등학교", fontSize: 10, fill: "#ef4444" }} />
                {gender === "male" && <ReferenceLine x="23세" stroke="#6b7280" strokeDasharray="3 3" label={{ value: "군입대", fontSize: 10, fill: "#6b7280" }} />}
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
          <p className="section-title">📋 성장 단계별 비용</p>
          <div className="space-y-2">
            {PHASES.filter((phase) => {
              if (gender === "female" && (phase.label === "군복무" || phase.label === "취준/사회초년")) return false;
              if (phase.ageStart > result.endAge) return false;
              return true;
            }).map((phase) => {
              const eduMult = EDU_MULTIPLIERS[eduStyle](phase.ageStart);
              const isPostGrad = phase.ageStart >= 23;
              const mult = isPostGrad ? 1.0 : eduMult * REGION_MULTIPLIER[region];
              const monthly = Math.round(phase.monthly * mult);
              const years = phase.ageEnd - phase.ageStart + 1;
              const total = monthly * 12 * years + (phase.oneTimeCost || 0);
              return (
                <div key={phase.label} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{phase.label} ({phase.ageStart}~{phase.ageEnd}세)</p>
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
            <li>부모 커리어 단절 비용 (주 양육자 기준 연 2,000~4,000만원 상당)</li>
            <li>학군 이동 이사비·전세 프리미엄 (+1~3억)</li>
            <li>자녀 결혼자금·전세 지원 (5,000만~2억 추가)</li>
            <li>의료비: 교정(500만+), 시력교정, 아토피 등</li>
            <li>해외 어학연수/교환학생 (1회 2,000~5,000만)</li>
            {gender === "male" && <li>군 전역 후 복학·취업 준비 공백기 생활비 (1~2년)</li>}
            <li>부모 여가·취미 시간 감소 = 삶의 질 기회비용</li>
          </ul>
        </div>

        <button onClick={() => setShowReceipt(true)} className="btn-primary w-full">
          <Receipt className="w-4 h-4" /> SNS 공유용 영수증 보기
        </button>

        <DisclaimerBanner text="비용은 통계청·보건사회연구원 기반 평균치이며, 지역·가정환경에 따라 크게 달라집니다. 부모급여(0세 월100만/1세 월50만), 아동수당 9세 미만 확대 반영." />

        <ReceiptModal open={showReceipt} onClose={() => setShowReceipt(false)}
          title={`👶 ${gender === "male" ? "아들" : "딸"} 1명 ${result.endAge}년 양육비 (${EDU_TABS.find((t) => t.key === eduStyle)?.label})`}
          footerMessage="이 수억 원의 기회비용보다 아이가 주는 평생의 감동이 더 크다면, 당신은 최고의 부모입니다. 👨‍👩‍👧">
          <div className="space-y-2">
            {PHASES.filter((p) => { if (gender === "female" && p.ageStart >= 23) return false; return p.ageStart <= result.endAge; }).map((phase) => {
              const mult = (phase.ageStart >= 23 ? 1.0 : EDU_MULTIPLIERS[eduStyle](phase.ageStart) * REGION_MULTIPLIER[region]);
              const monthly = Math.round(phase.monthly * mult);
              return (<div key={phase.label} className="flex justify-between"><span className="truncate">{phase.label}</span><span className="shrink-0 ml-2">월 {monthly}만</span></div>);
            })}
            <div className="border-t border-dashed border-gray-300 dark:border-gray-700 pt-2 mt-2">
              <div className="flex justify-between font-bold"><span>총 양육비</span><span>{formatManwon(result.totalNom)}</span></div>
              <div className="flex justify-between font-bold"><span>인플레 반영</span><span>{formatManwon(result.totalReal)}</span></div>
            </div>
            <div className="border-t border-dashed border-gray-300 dark:border-gray-700 pt-2 mt-2">
              <div className="flex justify-between text-blue-600 dark:text-blue-400"><span>S&P500</span><span>{formatManwon(result.sp500Final)}</span></div>
              <div className="flex justify-between text-purple-600 dark:text-purple-400"><span>나스닥</span><span>{formatManwon(result.nasdaqFinal)}</span></div>
            </div>
          </div>
        </ReceiptModal>
      </main>
    </div>
  );
}
