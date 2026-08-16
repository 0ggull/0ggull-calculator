"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Home, Receipt, TrendingDown, TrendingUp, Calculator, AlertCircle, Building } from "lucide-react";
import Header from "@/components/ui/Header";
import Slider from "@/components/ui/Slider";
import NumberInput from "@/components/ui/NumberInput";
import ResultCard from "@/components/ui/ResultCard";
import ReceiptModal from "@/components/ui/ReceiptModal";
import DisclaimerBanner from "@/components/ui/DisclaimerBanner";
import TabSelector from "@/components/ui/TabSelector";
import { formatManwon, formatPercent, DEPOSIT_RATE } from "@/lib/finance";

// ─── 타입 & 상수 ─────────────────────────────────────────
type HousingCount = "single" | "multi";
type LoanType = "interest_only" | "amortizing";

const HOUSING_TABS = [
  { key: "single", label: "1주택자", emoji: "🏠", subtitle: "비과세 대상" },
  { key: "multi", label: "다주택자", emoji: "🏢", subtitle: "일반세율" },
];

const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  interest_only: "이자만 상환 (만기일시)",
  amortizing: "원리금균등 상환",
};

// ─── 세금 계산 함수들 ─────────────────────────────────────
function calcAcquisitionTax(price: number, housing: HousingCount): number {
  const won = price * 10000;
  let rate: number;
  if (housing === "multi") {
    rate = 0.08; // 다주택 중과 8%
  } else {
    if (won <= 600000000) rate = 0.01;
    else if (won <= 900000000) rate = 0.022;
    else rate = 0.03;
  }
  return Math.round(price * rate * 1.1);
}

function calcCapitalGainsTax(
  buyPrice: number, sellPrice: number, holdYears: number,
  housing: HousingCount, deductibleExpense: number
): number {
  const gain = sellPrice - buyPrice - deductibleExpense;
  if (gain <= 0) return 0;

  if (housing === "single" && holdYears >= 2) {
    const won = sellPrice * 10000;
    if (won <= 1200000000) return 0;
    const taxableRatio = (won - 1200000000) / won;
    const taxableGain = gain * taxableRatio;
    return calcProgressiveTax(taxableGain, holdYears);
  }

  if (housing === "single" && holdYears < 2) {
    const rate = holdYears < 1 ? 0.70 : 0.60;
    return Math.round(gain * rate);
  }

  // 다주택 중과
  return Math.round(gain * 0.50);
}

function calcProgressiveTax(taxableGain: number, holdYears: number): number {
  // 장기보유특별공제 (1주택 거주: 연 8%, 최대 80%)
  const ltDeduction = Math.min(holdYears * 0.08, 0.80);
  const afterDeduction = taxableGain * (1 - ltDeduction);
  if (afterDeduction <= 0) return 0;

  const base = Math.max(0, afterDeduction - 250);
  const brackets = [
    { limit: 1400, rate: 0.06 }, { limit: 5000, rate: 0.15 },
    { limit: 8800, rate: 0.24 }, { limit: 15000, rate: 0.35 },
    { limit: 30000, rate: 0.38 }, { limit: 50000, rate: 0.40 },
    { limit: 100000, rate: 0.42 }, { limit: Infinity, rate: 0.45 },
  ];

  let tax = 0, remaining = base, prev = 0;
  for (const b of brackets) {
    const chunk = Math.min(remaining, b.limit - prev);
    if (chunk <= 0) break;
    tax += chunk * b.rate;
    remaining -= chunk;
    prev = b.limit;
  }
  return Math.round(tax);
}

function calcBrokerFee(price: number): number {
  const won = price * 10000;
  let rate: number;
  if (won < 200000000) rate = 0.005;
  else if (won < 600000000) rate = 0.004;
  else if (won < 900000000) rate = 0.005;
  else rate = 0.009;
  rate = Math.min(rate, 0.005);
  return Math.round(price * rate);
}

// 원리금균등 상환 총 이자
function calcAmortizingInterest(principal: number, annualRate: number, years: number): number {
  const monthlyRate = annualRate / 12;
  const n = years * 12;
  if (monthlyRate === 0) return 0;
  const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
  return Math.round(monthlyPayment * n - principal);
}

// ─── 메인 계산 ───────────────────────────────────────────
interface AptResult {
  acquisitionTax: number;
  legalFee: number;
  buyBroker: number;
  totalInterest: number;
  totalPropertyTax: number;
  sellBroker: number;
  capitalGainsTax: number;
  deductibleExpense: number;
  bepSellPrice: number;
  bepGainPercent: number;
  totalSunkCost: number;
  samePriceLoss: number;
  opportunityCost: number;
  savedRent: number;          // 주거비 절약 총액
  savedRentMonthly: number;   // 월 절약 주거비
  netBepSellPrice: number;    // 주거비 절약 반영한 실질 BEP
  netBepGainPercent: number;
}

function calculate(
  buyPrice: number, loanAmount: number, loanRate: number,
  holdYears: number, housing: HousingCount, interiorCost: number,
  annualPropertyTax: number, loanType: LoanType,
  jeonseRatio: number, conversionRate: number, isResiding: boolean
): AptResult {
  return calculateWithOverrides(buyPrice, loanAmount, loanRate, holdYears, housing, interiorCost, annualPropertyTax, loanType, jeonseRatio, conversionRate, isResiding, calcAcquisitionTax(buyPrice, housing), Math.round(buyPrice * 0.002), calcBrokerFee(buyPrice));
}

function calculateWithOverrides(
  buyPrice: number, loanAmount: number, loanRate: number,
  holdYears: number, housing: HousingCount, interiorCost: number,
  annualPropertyTax: number, loanType: LoanType,
  jeonseRatio: number, conversionRate: number, isResiding: boolean,
  acquisitionTax: number, legalFee: number, buyBroker: number
): AptResult {

  // 대출이자
  const totalInterest = loanType === "amortizing"
    ? calcAmortizingInterest(loanAmount, loanRate, holdYears)
    : Math.round(loanAmount * loanRate * holdYears);

  const totalPropertyTax = annualPropertyTax * holdYears;

  // 자기자본 기회비용
  const equity = buyPrice - loanAmount + acquisitionTax + legalFee + buyBroker + interiorCost;
  const opportunityCost = Math.round(equity * (Math.pow(1 + DEPOSIT_RATE, holdYears) - 1));

  // 주거비 절약 (실거주 시)
  let savedRent = 0;
  let savedRentMonthly = 0;
  if (isResiding) {
    const jeonseValue = buyPrice * jeonseRatio;
    savedRentMonthly = Math.round((jeonseValue * conversionRate) / 12);
    savedRent = savedRentMonthly * holdYears * 12;
  }

  // BEP 계산 (이분법)
  const roughSunk = acquisitionTax + legalFee + buyBroker + totalInterest + totalPropertyTax + interiorCost - savedRent;
  let bepSellPrice = buyPrice;
  let lo = buyPrice;
  let hi = buyPrice + Math.max(roughSunk * 3, buyPrice * 0.5);

  for (let i = 0; i < 100; i++) {
    const mid = Math.round((lo + hi) / 2);
    const sellBroker = calcBrokerFee(mid);
    const cgt = calcCapitalGainsTax(buyPrice, mid, holdYears, housing, interiorCost);
    const totalCosts = acquisitionTax + legalFee + buyBroker + totalInterest + totalPropertyTax + sellBroker + cgt + interiorCost;
    const netProfit = mid - buyPrice - totalCosts;
    if (Math.abs(netProfit) < 5) { bepSellPrice = mid; break; }
    if (netProfit < 0) lo = mid;
    else { hi = mid; bepSellPrice = mid; }
  }

  // 주거비 절약 반영한 실질 BEP
  let netBepSellPrice = buyPrice;
  lo = buyPrice;
  hi = buyPrice + Math.max(roughSunk * 3, buyPrice * 0.5);
  for (let i = 0; i < 100; i++) {
    const mid = Math.round((lo + hi) / 2);
    const sellBroker = calcBrokerFee(mid);
    const cgt = calcCapitalGainsTax(buyPrice, mid, holdYears, housing, interiorCost);
    const totalCosts = acquisitionTax + legalFee + buyBroker + totalInterest + totalPropertyTax + sellBroker + cgt + interiorCost - savedRent;
    const netProfit = mid - buyPrice - totalCosts;
    if (Math.abs(netProfit) < 5) { netBepSellPrice = mid; break; }
    if (netProfit < 0) lo = mid;
    else { hi = mid; netBepSellPrice = mid; }
  }

  const sellBroker = calcBrokerFee(bepSellPrice);
  const capitalGainsTax = calcCapitalGainsTax(buyPrice, bepSellPrice, holdYears, housing, interiorCost);
  const bepGainPercent = ((bepSellPrice - buyPrice) / buyPrice) * 100;
  const netBepGainPercent = ((netBepSellPrice - buyPrice) / buyPrice) * 100;

  const samePriceSellBroker = calcBrokerFee(buyPrice);
  const samePriceLoss = acquisitionTax + legalFee + buyBroker + totalInterest + totalPropertyTax + samePriceSellBroker + interiorCost;
  const totalSunkCost = acquisitionTax + legalFee + buyBroker + totalInterest + totalPropertyTax + interiorCost;

  return {
    acquisitionTax, legalFee, buyBroker, totalInterest, totalPropertyTax,
    sellBroker, capitalGainsTax, deductibleExpense: interiorCost,
    bepSellPrice, bepGainPercent, totalSunkCost, samePriceLoss, opportunityCost,
    savedRent, savedRentMonthly, netBepSellPrice, netBepGainPercent,
  };
}

// ─── 컴포넌트 ───────────────────────────────────────────
export default function ApartmentCalculator() {
  const [buyPrice, setBuyPrice] = useState(120000);
  const [loanAmount, setLoanAmount] = useState(60000);
  const [loanRate, setLoanRate] = useState(4.0);
  const [holdYears, setHoldYears] = useState(3);
  const [housing, setHousing] = useState<HousingCount>("single");
  const [interiorCost, setInteriorCost] = useState(2000);
  const [annualPropertyTax, setAnnualPropertyTax] = useState(200);
  const [loanType, setLoanType] = useState<LoanType>("interest_only");
  const [isResiding, setIsResiding] = useState(true);
  const [jeonseRatio, setJeonseRatio] = useState(55);
  const [conversionRate, setConversionRate] = useState(4.5);
  const [showReceipt, setShowReceipt] = useState(false);

  // 사용자 수정 가능한 비용 (기본값은 자동 계산)
  const [customAcqTax, setCustomAcqTax] = useState<number | null>(null);
  const [customLegalFee, setCustomLegalFee] = useState<number | null>(null);
  const [customBuyBroker, setCustomBuyBroker] = useState<number | null>(null);

  // 자동 계산된 기본값
  const autoAcqTax = calcAcquisitionTax(buyPrice, housing);
  const autoLegalFee = Math.round(buyPrice * 0.002);
  const autoBuyBroker = calcBrokerFee(buyPrice);

  // 실제 사용값 (사용자 수정값 우선, 없으면 자동값)
  const effectiveAcqTax = customAcqTax ?? autoAcqTax;
  const effectiveLegalFee = customLegalFee ?? autoLegalFee;
  const effectiveBuyBroker = customBuyBroker ?? autoBuyBroker;

  const result = useMemo(
    () => calculateWithOverrides(buyPrice, loanAmount, loanRate / 100, holdYears, housing, interiorCost, annualPropertyTax, loanType, jeonseRatio / 100, conversionRate / 100, isResiding, effectiveAcqTax, effectiveLegalFee, effectiveBuyBroker),
    [buyPrice, loanAmount, loanRate, holdYears, housing, interiorCost, annualPropertyTax, loanType, jeonseRatio, conversionRate, isResiding, effectiveAcqTax, effectiveLegalFee, effectiveBuyBroker]
  );

  const costBreakdown = [
    { name: "취득세", value: result.acquisitionTax, color: "#ef4444" },
    { name: "법무사·채권", value: result.legalFee, color: "#f97316" },
    { name: "매수 복비", value: result.buyBroker, color: "#eab308" },
    { name: "대출이자", value: result.totalInterest, color: "#8b5cf6" },
    { name: "재산세", value: result.totalPropertyTax, color: "#06b6d4" },
    { name: "인테리어", value: result.deductibleExpense, color: "#10b981" },
    { name: "매도 복비", value: result.sellBroker, color: "#f43f5e" },
    ...(result.savedRent > 0 ? [{ name: "주거비 절약(-)", value: -result.savedRent, color: "#22c55e" }] : []),
  ];

  return (
    <div className="min-h-screen">
      <Header title="아파트 매도 BEP" showBack />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <TabSelector tabs={HOUSING_TABS} active={housing} onChange={(k) => setHousing(k as HousingCount)} />

        {/* 핵심 입력 */}
        <div className="card p-5 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">매수가</label>
            <div className="flex items-center gap-3">
              <input type="number" value={buyPrice} onChange={(e) => setBuyPrice(Math.max(1000, Number(e.target.value) || 0))} className="input-field flex-1" step={1000} />
              <span className="text-sm text-gray-500 shrink-0">{formatManwon(buyPrice)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">대출 금액</label>
            <div className="flex items-center gap-3">
              <input type="number" value={loanAmount} onChange={(e) => setLoanAmount(Math.max(0, Number(e.target.value) || 0))} className="input-field flex-1" step={1000} />
              <span className="text-sm text-gray-500 shrink-0">{formatManwon(loanAmount)}</span>
            </div>
          </div>
          <Slider label="대출 금리" value={loanRate} min={2.0} max={8.0} step={0.1} onChange={setLoanRate} formatDisplay={(v) => `연 ${v.toFixed(1)}%`} />

          {/* 상환 방식 */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">대출 상환 방식</p>
            <div className="flex gap-2">
              {(Object.keys(LOAN_TYPE_LABELS) as LoanType[]).map((lt) => (
                <button key={lt} onClick={() => setLoanType(lt)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${loanType === lt ? "bg-brand-50 dark:bg-brand-950 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"}`}>
                  {LOAN_TYPE_LABELS[lt]}
                </button>
              ))}
            </div>
          </div>

          {/* 보유기간 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">보유 예정 기간</label>
            <div className="flex items-center gap-3">
              <input type="number" value={holdYears} onChange={(e) => setHoldYears(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} className="input-field w-24" min={1} max={30} />
              <span className="text-sm text-gray-500">년</span>
              <div className="flex gap-1.5 flex-wrap flex-1">
                {[2, 3, 5, 7, 10].map((y) => (
                  <button key={y} onClick={() => setHoldYears(y)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${holdYears === y ? "bg-brand-50 dark:bg-brand-950 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-500"}`}>
                    {y}년
                  </button>
                ))}
              </div>
            </div>
            {holdYears < 2 && <p className="text-xs text-rose-500 font-medium">⚠️ 2년 미만 보유 시 양도세 중과 ({holdYears < 1 ? "70%" : "60%"}) 적용됩니다</p>}
          </div>
        </div>

        {/* 실거주 & 주거비 절약 */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">🏡 실거주 여부</p>
              <p className="text-xs text-gray-400">거주 시 전세/월세 안 내는 주거비 절약 반영</p>
            </div>
            <button onClick={() => setIsResiding(!isResiding)}
              className={`w-12 h-6 rounded-full transition-colors duration-200 ${isResiding ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${isResiding ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>
          {isResiding && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="space-y-1">
                <label className="text-xs text-gray-500">전세가율 (%)</label>
                <input type="number" value={jeonseRatio} onChange={(e) => setJeonseRatio(Number(e.target.value) || 50)} className="input-field" step={5} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">월세 전환이율 (%)</label>
                <input type="number" value={conversionRate} onChange={(e) => setConversionRate(Number(e.target.value) || 4)} className="input-field" step={0.5} />
              </div>
              <div className="col-span-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
                <p className="text-xs text-gray-600 dark:text-gray-400">내 집 거주로 절약되는 주거비</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">월 {result.savedRentMonthly.toLocaleString()}만원 ({holdYears}년 총 {formatManwon(result.savedRent)})</p>
              </div>
            </div>
          )}
        </div>

        {/* 상세 설정 */}
        <details className="card overflow-hidden">
          <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            🏗️ 비용 상세 직접 수정 (자동 계산값 기본 입력)
          </summary>
          <div className="px-5 pb-5 grid grid-cols-2 md:grid-cols-3 gap-3 border-t border-gray-100 dark:border-gray-800 pt-4">
            <NumberInput label="취득세+지방교육세" value={effectiveAcqTax} onChange={(v) => setCustomAcqTax(v)} hint={`자동: ${autoAcqTax.toLocaleString()}만원`} />
            <NumberInput label="법무사+채권 할인" value={effectiveLegalFee} onChange={(v) => setCustomLegalFee(v)} hint={`자동: ${autoLegalFee.toLocaleString()}만원`} />
            <NumberInput label="매수 중개보수" value={effectiveBuyBroker} onChange={(v) => setCustomBuyBroker(v)} hint={`자동: ${autoBuyBroker.toLocaleString()}만원`} />
            <NumberInput label="인테리어/자본적 지출" value={interiorCost} onChange={setInteriorCost} hint="양도세 경비 인정 항목" />
            <NumberInput label="연간 재산세+종부세" value={annualPropertyTax} onChange={setAnnualPropertyTax} />
          </div>
          <div className="px-5 pb-4">
            <button onClick={() => { setCustomAcqTax(null); setCustomLegalFee(null); setCustomBuyBroker(null); }}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
              ↺ 자동 계산값으로 초기화
            </button>
          </div>
        </details>

        {/* 핵심 결과 */}
        <div className="card p-6 bg-gradient-to-br from-sky-50 to-indigo-50 dark:from-sky-950/20 dark:to-indigo-950/20 border-sky-200 dark:border-sky-800/50 space-y-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-brand-500" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">이 집은 최소</p>
          </div>
          <p className="text-3xl md:text-4xl font-bold text-brand-600 dark:text-brand-400">{formatManwon(result.bepSellPrice)}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            이상에 팔아야 본전 (매수가 대비 <span className="font-semibold text-amber-600">{formatPercent(result.bepGainPercent)}</span>)
          </p>
          {isResiding && result.savedRent > 0 && (
            <div className="pt-2 border-t border-sky-200 dark:border-sky-800">
              <p className="text-xs text-gray-500">주거비 절약 반영 시 실질 BEP</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatManwon(result.netBepSellPrice)} <span className="text-sm font-normal">({formatPercent(result.netBepGainPercent)})</span></p>
            </div>
          )}
        </div>

        {/* 전세 대안 비교 */}
        {isResiding && (
          <div className="card p-5 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border-indigo-200 dark:border-indigo-800/50 space-y-2">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-500" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">사지 않고 전세로 살았다면?</p>
            </div>
            <p className="text-xs text-gray-500">전세보증금 {formatManwon(Math.round(buyPrice * jeonseRatio / 100))}을 예금(연 {DEPOSIT_RATE * 100}%)에 넣는 대신 전세 거주</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              자기자본 {formatManwon(buyPrice - loanAmount)}을 {holdYears}년간 예금에 넣었다면: <span className="font-bold text-purple-600 dark:text-purple-400">+{formatManwon(result.opportunityCost)}</span> 이자 수익
            </p>
          </div>
        )}

        {/* 산 가격 그대로 팔면 */}
        <div className="card p-5 bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/20 dark:to-red-950/20 border-rose-200 dark:border-rose-800/50">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-rose-500" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">산 가격 그대로 ({formatManwon(buyPrice)}) 매도 시</p>
          </div>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">-{formatManwon(result.samePriceLoss)} 손해</p>
          {isResiding && <p className="text-xs text-gray-500 mt-1">단, 주거비 절약 {formatManwon(result.savedRent)} 고려 시 실질 손해: -{formatManwon(Math.max(0, result.samePriceLoss - result.savedRent))}</p>}
        </div>

        {/* 결과 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ResultCard icon={<TrendingDown className="w-5 h-5" />} label="총 매몰비용" value={formatManwon(result.totalSunkCost)} sublabel={`${holdYears}년 보유 기준`} accent="red" />
          <ResultCard icon={<TrendingUp className="w-5 h-5" />} label="자기자본 기회비용 (예금 연 4%)" value={formatManwon(result.opportunityCost)} sublabel={`자기자본 ${formatManwon(buyPrice - loanAmount)}`} accent="purple" />
        </div>

        {/* 비용 분해 차트 */}
        <div className="card p-5">
          <p className="section-title mb-4">📊 비용 내역</p>
          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costBreakdown} layout="vertical" margin={{ top: 5, right: 30, left: 70, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
                <XAxis type="number" tickFormatter={(v: number) => formatManwon(v)} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(v: number) => formatManwon(v)} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {costBreakdown.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 상세 테이블 */}
        <div className="card p-5 space-y-3">
          <p className="section-title">🧾 비용 상세</p>
          <div className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
            <div className="flex justify-between py-2"><span className="text-gray-600 dark:text-gray-400">취득세 + 지방교육세</span><span className="font-medium">{formatManwon(result.acquisitionTax)}</span></div>
            <div className="flex justify-between py-2"><span className="text-gray-600 dark:text-gray-400">법무사 + 채권할인</span><span className="font-medium">{formatManwon(result.legalFee)}</span></div>
            <div className="flex justify-between py-2"><span className="text-gray-600 dark:text-gray-400">매수 중개보수</span><span className="font-medium">{formatManwon(result.buyBroker)}</span></div>
            <div className="flex justify-between py-2"><span className="text-gray-600 dark:text-gray-400">대출이자 ({holdYears}년, {LOAN_TYPE_LABELS[loanType]})</span><span className="font-medium text-purple-600">{formatManwon(result.totalInterest)}</span></div>
            <div className="flex justify-between py-2"><span className="text-gray-600 dark:text-gray-400">재산세·종부세 ({holdYears}년)</span><span className="font-medium">{formatManwon(result.totalPropertyTax)}</span></div>
            <div className="flex justify-between py-2"><span className="text-gray-600 dark:text-gray-400">인테리어</span><span className="font-medium">{formatManwon(result.deductibleExpense)}</span></div>
            <div className="flex justify-between py-2"><span className="text-gray-600 dark:text-gray-400">매도 중개보수</span><span className="font-medium">{formatManwon(result.sellBroker)}</span></div>
            {result.capitalGainsTax > 0 && <div className="flex justify-between py-2"><span className="text-gray-600 dark:text-gray-400">양도소득세</span><span className="font-medium text-rose-600">{formatManwon(result.capitalGainsTax)}</span></div>}
            {isResiding && <div className="flex justify-between py-2 text-emerald-600"><span>주거비 절약 (차감)</span><span className="font-medium">-{formatManwon(result.savedRent)}</span></div>}
            <div className="flex justify-between py-3 font-bold text-base border-t-2 border-gray-200 dark:border-gray-700 mt-2">
              <span>BEP 매도가{isResiding ? " (주거비 반영)" : ""}</span>
              <span className="text-brand-600 dark:text-brand-400">{formatManwon(isResiding ? result.netBepSellPrice : result.bepSellPrice)}</span>
            </div>
          </div>
        </div>

        {/* 숨은 비용 */}
        <div className="card p-5 space-y-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">💡 자주 간과하는 숨은 비용</p>
          <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>이사비 (포장이사 100~400만원) × 매수+매도 = 2회</li>
            <li>입주 후 가전·가구 교체 (500~2,000만원)</li>
            <li>관리비 인상분 (장기수선충당금, 난방비)</li>
            <li>대출 중도상환 수수료 (고정금리: 원금의 1~1.5%)</li>
            <li>매도 시 스테이징·청소 (50~200만원)</li>
            <li>공실 리스크: 매도까지 걸리는 기간의 기회비용</li>
            <li>정책 변동: 대출규제·DSR·세율 변경</li>
          </ul>
        </div>

        <button onClick={() => setShowReceipt(true)} className="btn-primary w-full">
          <Receipt className="w-4 h-4" /> SNS 공유용 영수증 보기
        </button>

        <DisclaimerBanner text="세율·제도는 수시 변경됩니다. 양도세는 거주기간·조정지역 여부에 따라 크게 달라지며, 비거주 1주택 장특공 폐지 논의가 진행 중입니다. 반드시 세무사와 상담하세요." />

        <ReceiptModal open={showReceipt} onClose={() => setShowReceipt(false)}
          title={`🏠 아파트 ${formatManwon(buyPrice)} 매도 BEP`}
          footerMessage="내 집이 주는 안정감과 자산 형성의 가치까지 포함하면, 숫자만으로 판단할 수 없는 것들이 있습니다.">
          <div className="space-y-2">
            <div className="flex justify-between"><span>매수가</span><span>{formatManwon(buyPrice)}</span></div>
            <div className="flex justify-between"><span>취득세</span><span>{formatManwon(result.acquisitionTax)}</span></div>
            <div className="flex justify-between"><span>대출이자 ({holdYears}년)</span><span>{formatManwon(result.totalInterest)}</span></div>
            <div className="flex justify-between"><span>재산세</span><span>{formatManwon(result.totalPropertyTax)}</span></div>
            <div className="flex justify-between"><span>중개수수료 합계</span><span>{formatManwon(result.buyBroker + result.sellBroker)}</span></div>
            <div className="flex justify-between"><span>인테리어</span><span>{formatManwon(interiorCost)}</span></div>
            {isResiding && <div className="flex justify-between text-emerald-600"><span>주거비 절약</span><span>-{formatManwon(result.savedRent)}</span></div>}
            <div className="border-t border-dashed border-gray-300 dark:border-gray-700 pt-2 mt-2">
              <div className="flex justify-between font-bold"><span>본전 매도가</span><span>{formatManwon(isResiding ? result.netBepSellPrice : result.bepSellPrice)}</span></div>
              <div className="flex justify-between text-xs text-gray-500"><span>필요 상승률</span><span>{formatPercent(isResiding ? result.netBepGainPercent : result.bepGainPercent)}</span></div>
            </div>
            <div className="border-t border-dashed border-gray-300 dark:border-gray-700 pt-2 mt-2">
              <div className="flex justify-between text-rose-600"><span>그대로 팔면 손해</span><span>-{formatManwon(result.samePriceLoss)}</span></div>
            </div>
          </div>
        </ReceiptModal>
      </main>
    </div>
  );
}
