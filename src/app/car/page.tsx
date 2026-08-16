"use client";

import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Car, Bus, TrendingUp, Receipt, Fuel } from "lucide-react";
import Header from "@/components/ui/Header";
import TabSelector from "@/components/ui/TabSelector";
import Slider from "@/components/ui/Slider";
import NumberInput from "@/components/ui/NumberInput";
import ResultCard from "@/components/ui/ResultCard";
import ReceiptModal from "@/components/ui/ReceiptModal";
import DisclaimerBanner from "@/components/ui/DisclaimerBanner";
import { formatManwon, SP500_RATE, NASDAQ_RATE } from "@/lib/finance";

// ─── 타입 & 상수 ─────────────────────────────────────────
type CarType = "avante" | "sorento" | "grandeur" | "tesla";
type PurchaseType = "cash" | "loan36" | "loan60";

interface CarPreset {
  label: string; price: number; depRate: number; efficiency: number;
  effUnit: string; fuelPrice: number; annualInsureTax: number; annualMaint: number; isEV: boolean;
}

const CAR_TABS = [
  { key: "avante", label: "아반떼/경차급", emoji: "🚗", subtitle: "2,600만" },
  { key: "sorento", label: "쏘렌토/스포티지", emoji: "🚙", subtitle: "4,200만" },
  { key: "grandeur", label: "그랜저/제네시스", emoji: "🏎️", subtitle: "6,300만" },
  { key: "tesla", label: "테슬라/전기차", emoji: "⚡", subtitle: "5,800만" },
];

const PRESETS: Record<CarType, CarPreset> = {
  avante: { label: "아반떼/경차급", price: 2600, depRate: 0.10, efficiency: 14, effUnit: "km/L", fuelPrice: 1860, annualInsureTax: 125, annualMaint: 65, isEV: false },
  sorento: { label: "쏘렌토/스포티지급", price: 4200, depRate: 0.09, efficiency: 11, effUnit: "km/L", fuelPrice: 1860, annualInsureTax: 155, annualMaint: 95, isEV: false },
  grandeur: { label: "그랜저/제네시스급", price: 6300, depRate: 0.10, efficiency: 9, effUnit: "km/L", fuelPrice: 1860, annualInsureTax: 215, annualMaint: 135, isEV: false },
  tesla: { label: "테슬라/전기차", price: 5800, depRate: 0.11, efficiency: 5.5, effUnit: "km/kWh", fuelPrice: 350, annualInsureTax: 150, annualMaint: 45, isEV: true },
};

const PURCHASE_OPTIONS: { key: PurchaseType; label: string }[] = [
  { key: "cash", label: "현금 일시불" },
  { key: "loan36", label: "36개월 할부" },
  { key: "loan60", label: "60개월 할부" },
];

const LOAN_RATE = 0.045; // 할부 금리 4.5%

// 택시 요금
const TAXI_BASE_FARE = 4800;
const TAXI_BASE_DIST = 1.6;
const TAXI_PER_131M = 100;
const TAXI_COST_PER_KM = TAXI_PER_131M / 0.131;

function taxiCostForKm(totalKm: number, avgTripKm: number): number {
  const numTrips = totalKm / avgTripKm;
  const costPerTrip = TAXI_BASE_FARE + Math.max(0, avgTripKm - TAXI_BASE_DIST) * TAXI_COST_PER_KM;
  return numTrips * costPerTrip;
}

// 할부 이자 총액
function loanInterest(principal: number, annualRate: number, months: number): number {
  const r = annualRate / 12;
  if (r === 0) return 0;
  const payment = principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  return Math.round((payment * months - principal) / 10000); // 만원
}

// ─── 계산 ─────────────────────────────────────────────────
interface CalcResult {
  carMonthly: number; carTotal: number;
  taxiOnlyMonthly: number; taxiOnlyTotal: number;
  realisticMonthly: number; realisticTotal: number;
  savings: number; sp500: number; nasdaq: number;
  yearlyData: { year: number; carCum: number; realisticCum: number; sp500: number; nasdaq: number }[];
  depreciation: number; fuelTotal: number; residualValue: number;
  carCostPerKm: number; taxiCostPerKm: number;
  loanInterestTotal: number;
}

function calculate(
  preset: CarPreset, years: number, annualKm: number,
  monthlyParking: number, purchaseType: PurchaseType, avgTripKm: number
): CalcResult {
  const { price, depRate, efficiency, fuelPrice, annualInsureTax, annualMaint } = preset;

  // 취득세 (신차 7%, 중고 7%)
  const acquisitionTax = Math.round(price * 0.07);

  // 할부 이자
  const loanMonths = purchaseType === "loan36" ? 36 : purchaseType === "loan60" ? 60 : 0;
  const loanInterestTotal = purchaseType !== "cash" ? loanInterest(price * 10000, LOAN_RATE, loanMonths) : 0;

  // 감가상각
  let residual = price;
  let totalDep = 0;
  for (let y = 0; y < years; y++) {
    const dep = residual * depRate;
    totalDep += dep;
    residual -= dep;
  }

  // 유류비
  const annualFuelWon = (annualKm / efficiency) * fuelPrice;
  const annualFuel = annualFuelWon / 10000;

  // 주차/통행료
  const annualParking = monthlyParking * 12;

  // 총 비용 (잔존가치 차감)
  const totalCarCost = acquisitionTax + loanInterestTotal + totalDep + (annualInsureTax + annualMaint + annualFuel + annualParking) * years - residual;
  const monthlyCarCost = totalCarCost / (years * 12);
  const carCostPerKm = Math.round((totalCarCost * 10000) / (annualKm * years));

  // 택시
  const annualTaxiCost = taxiCostForKm(annualKm, avgTripKm) / 10000;
  const monthlyTaxi = annualTaxiCost / 12;
  const taxiCostPerKm = Math.round(taxiCostForKm(annualKm, avgTripKm) / annualKm);

  // 현실적 대안
  const realisticMonthly = 41; // 대중교통 9 + 택시 16 + 쏘카 16
  const realisticTotal = realisticMonthly * years * 12;

  const savings = monthlyCarCost - realisticMonthly;
  const monthlySavingsForInvest = Math.max(0, savings);
  const mSP = SP500_RATE / 12, mNQ = NASDAQ_RATE / 12;

  let sp500 = 0, nasdaq = 0;
  const yearlyData: CalcResult["yearlyData"] = [];
  let carCum = acquisitionTax + loanInterestTotal;
  let residualForChart = price;

  for (let y = 1; y <= years; y++) {
    const yearDep = residualForChart * depRate;
    residualForChart -= yearDep;
    carCum += annualInsureTax + annualMaint + annualFuel + annualParking + yearDep;
    const realisticCum = realisticMonthly * y * 12;

    for (let m = 0; m < 12; m++) {
      sp500 = sp500 * (1 + mSP) + monthlySavingsForInvest;
      nasdaq = nasdaq * (1 + mNQ) + monthlySavingsForInvest;
    }

    yearlyData.push({
      year: y,
      carCum: Math.round(y === years ? carCum - residualForChart : carCum),
      realisticCum: Math.round(realisticCum),
      sp500: Math.round(sp500), nasdaq: Math.round(nasdaq),
    });
  }

  return {
    carMonthly: Math.round(monthlyCarCost * 10) / 10, carTotal: Math.round(totalCarCost),
    taxiOnlyMonthly: Math.round(monthlyTaxi * 10) / 10, taxiOnlyTotal: Math.round(annualTaxiCost * years),
    realisticMonthly, realisticTotal,
    savings: Math.round(savings * 10) / 10, sp500: Math.round(sp500), nasdaq: Math.round(nasdaq),
    yearlyData, depreciation: Math.round(totalDep), fuelTotal: Math.round(annualFuel * years),
    residualValue: Math.round(residual), carCostPerKm, taxiCostPerKm, loanInterestTotal,
  };
}

// ─── 컴포넌트 ───────────────────────────────────────────
export default function CarCalculator() {
  const [carType, setCarType] = useState<CarType>("avante");
  const [years, setYears] = useState(5);
  const [annualKm, setAnnualKm] = useState(15000);
  const [monthlyParking, setMonthlyParking] = useState(10);
  const [purchaseType, setPurchaseType] = useState<PurchaseType>("cash");
  const [avgTripKm, setAvgTripKm] = useState(5);
  const [showReceipt, setShowReceipt] = useState(false);
  const [custom, setCustom] = useState(PRESETS.avante);

  const handleCarChange = (key: string) => {
    const ct = key as CarType;
    setCarType(ct);
    setCustom(PRESETS[ct]);
  };

  const result = useMemo(() => calculate(custom, years, annualKm, monthlyParking, purchaseType, avgTripKm), [custom, years, annualKm, monthlyParking, purchaseType, avgTripKm]);

  const chartData = result.yearlyData.map((d) => ({
    name: `${d.year}년`, "자차 누적": d.carCum, "대안 누적": d.realisticCum,
    "차액→S&P500": d.sp500, "차액→나스닥": d.nasdaq,
  }));

  return (
    <div className="min-h-screen">
      <Header title="자동차 vs 대중교통" showBack />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <TabSelector tabs={CAR_TABS} active={carType} onChange={handleCarChange} />

        {/* 구매 방식 */}
        <div className="card p-5 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">구매 방식</p>
            <div className="flex gap-2">
              {PURCHASE_OPTIONS.map((opt) => (
                <button key={opt.key} onClick={() => setPurchaseType(opt.key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${purchaseType === opt.key ? "bg-brand-50 dark:bg-brand-950 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {purchaseType !== "cash" && (
              <p className="text-xs text-amber-600 dark:text-amber-400">💰 할부 금리 4.5% 적용 → 이자 총 {formatManwon(result.loanInterestTotal)} 추가</p>
            )}
          </div>
          <p className="text-xs text-gray-400">💡 중고차 구매 시: 상세 설정에서 차량 가격을 직접 낮춰서 입력하세요.</p>
        </div>

        {/* 슬라이더 */}
        <div className="card p-5 space-y-5">
          <Slider label="보유 기간" value={years} min={1} max={10} unit="년" onChange={setYears} />
          <Slider label="연간 주행거리" value={annualKm} min={5000} max={30000} step={1000} unit="km" onChange={setAnnualKm} formatDisplay={(v) => `${(v / 10000).toFixed(1)}만km`} />
          <Slider label="월 주차비/통행료" value={monthlyParking} min={0} max={30} unit="만원" onChange={setMonthlyParking} />
          <Slider label="택시 평균 탑승거리" value={avgTripKm} min={2} max={15} step={1} unit="km" onChange={setAvgTripKm} formatDisplay={(v) => `${v}km/회`} />
        </div>

        {/* 상세 수정 */}
        <details className="card overflow-hidden">
          <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            🔧 차량 상세 설정 직접 수정
          </summary>
          <div className="px-5 pb-5 grid grid-cols-2 md:grid-cols-3 gap-3 border-t border-gray-100 dark:border-gray-800 pt-4">
            <NumberInput label="차량 가격" value={custom.price} onChange={(v) => setCustom({ ...custom, price: v })} />
            <NumberInput label="연 감가율" value={Math.round(custom.depRate * 100)} onChange={(v) => setCustom({ ...custom, depRate: v / 100 })} unit="%" />
            <NumberInput label={`연비 (${custom.effUnit})`} value={custom.efficiency} onChange={(v) => setCustom({ ...custom, efficiency: v })} unit={custom.effUnit} step={0.5} />
            <NumberInput label={custom.isEV ? "전기요금 (원/kWh)" : "유류 단가 (원/L)"} value={custom.fuelPrice} onChange={(v) => setCustom({ ...custom, fuelPrice: v })} unit="원" />
            <NumberInput label="연간 보험+세금" value={custom.annualInsureTax} onChange={(v) => setCustom({ ...custom, annualInsureTax: v })} />
            <NumberInput label="연간 정비비" value={custom.annualMaint} onChange={(v) => setCustom({ ...custom, annualMaint: v })} />
          </div>
        </details>

        {/* 핵심 결과 */}
        <div className="card p-6 bg-gradient-to-br from-rose-50 to-amber-50 dark:from-rose-950/20 dark:to-amber-950/20 border-rose-200 dark:border-rose-800/50">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">차량 소유 시 ({years}년 후 매도 가정)</p>
          <p className="text-3xl md:text-4xl font-bold text-rose-600 dark:text-rose-400">월 {result.carMonthly.toLocaleString()}만원</p>
          <p className="text-sm text-gray-500 mt-1">{years}년 총 {formatManwon(result.carTotal)} (중고매도 {formatManwon(result.residualValue)} 차감 반영)</p>
        </div>

        {/* km당 비용 비교 */}
        <div className="card p-5 space-y-3">
          <p className="section-title">📏 km당 비용 비교</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-xl text-center">
              <p className="text-xs text-gray-500 mb-1">자차 (전체 비용 ÷ 총 주행거리)</p>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{result.carCostPerKm.toLocaleString()}원</p>
              <p className="text-xs text-gray-400">/ km</p>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-center">
              <p className="text-xs text-gray-500 mb-1">택시 (평균 {avgTripKm}km 탑승)</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{result.taxiCostPerKm.toLocaleString()}원</p>
              <p className="text-xs text-gray-400">/ km</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">* 택시: 기본요금 4,800원(1.6km) + 131m당 100원. 평균 {avgTripKm}km 탑승 가정.</p>
        </div>

        {/* 비교 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ResultCard icon={<Car className="w-5 h-5" />} label="100% 택시 (충격요법)" value={`월 ${result.taxiOnlyMonthly.toLocaleString()}만원`} sublabel={`평균 ${avgTripKm}km씩, 연 ${(annualKm / 10000).toFixed(1)}만km`} accent="amber" />
          <ResultCard icon={<Bus className="w-5 h-5" />} label="현실적 대안 (대중교통+택시+쏘카)" value={`월 ${result.realisticMonthly}만원`} sublabel="대중교통 9 + 택시 16 + 쏘카 16만원" accent="green" />
        </div>

        {/* 절약 & 기회비용 */}
        {result.savings > 0 && (
          <div className="card p-6 bg-gradient-to-br from-emerald-50 to-sky-50 dark:from-emerald-950/20 dark:to-sky-950/20 border-emerald-200 dark:border-emerald-800/50 space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              대안으로 전환 시 매월 <span className="font-bold text-emerald-600 dark:text-emerald-400">{result.savings.toLocaleString()}만원</span> 절약
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-white/60 dark:bg-gray-900/60 rounded-xl">
                <p className="text-xs text-gray-500">차액 → S&P500 ({years}년)</p>
                <p className="text-xl font-bold text-brand-600 dark:text-brand-400">{formatManwon(result.sp500)}</p>
              </div>
              <div className="p-3 bg-white/60 dark:bg-gray-900/60 rounded-xl">
                <p className="text-xs text-gray-500">차액 → 나스닥 ({years}년)</p>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{formatManwon(result.nasdaq)}</p>
              </div>
            </div>
          </div>
        )}

        {/* 비용 분해 */}
        <div className="card p-5 space-y-3">
          <p className="section-title">🧾 자차 비용 분해</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"><span className="text-gray-600 dark:text-gray-400">취득세 (7%)</span><span>{formatManwon(Math.round(custom.price * 0.07))}</span></div>
            {result.loanInterestTotal > 0 && <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"><span className="text-gray-600 dark:text-gray-400">할부 이자</span><span className="text-amber-600">{formatManwon(result.loanInterestTotal)}</span></div>}
            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"><span className="text-gray-600 dark:text-gray-400">감가상각</span><span>{formatManwon(result.depreciation)}</span></div>
            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"><span className="text-gray-600 dark:text-gray-400">유류비</span><span>{formatManwon(result.fuelTotal)}</span></div>
            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"><span className="text-gray-600 dark:text-gray-400">보험+세금</span><span>{formatManwon(custom.annualInsureTax * years)}</span></div>
            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"><span className="text-gray-600 dark:text-gray-400">정비비</span><span>{formatManwon(custom.annualMaint * years)}</span></div>
            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"><span className="text-gray-600 dark:text-gray-400">주차/통행료</span><span>{formatManwon(monthlyParking * 12 * years)}</span></div>
            <div className="flex justify-between p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg"><span className="text-emerald-700 dark:text-emerald-400">중고 매도 차감</span><span className="text-emerald-600">-{formatManwon(result.residualValue)}</span></div>
          </div>
        </div>

        {/* 차트 */}
        <div className="card p-5">
          <p className="section-title mb-4">📊 누적 비용 비교</p>
          <div className="h-72 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}억` : `${v}`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatManwon(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="자차 누적" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="대안 누적" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="차액→S&P500" stroke="#0ea5e9" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="차액→나스닥" stroke="#8b5cf6" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 숨은 비용 */}
        <div className="card p-5 space-y-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">💡 자주 간과하는 숨은 비용</p>
          <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>사고 시 보험료 할증 (무사고 3년 vs 사고 → 연 30~80만원 차이)</li>
            <li>세차·광택·틴팅 유지비 (연 30~60만원)</li>
            <li>차 있으면 외출·쇼핑 충동 소비 증가 (평균 15~20% ↑)</li>
            <li>교통 벌금·범칙금 (연 평균 10~20만원)</li>
            <li>중고 매도 시 실제 감가가 정률 이상 (첫 1년 20~30% 하락)</li>
            {purchaseType !== "cash" && <li>할부 중도상환 수수료 (잔액의 1~2%)</li>}
            <li>장기렌트/리스 대비 자차 소유의 유연성 비용</li>
          </ul>
        </div>

        <button onClick={() => setShowReceipt(true)} className="btn-primary w-full">
          <Receipt className="w-4 h-4" /> SNS 공유용 영수증 보기
        </button>

        <DisclaimerBanner text="택시 요금은 서울 기준이며, 지역·시간대(심야 할증)에 따라 달라집니다. 유류비는 전국 평균 기준. 실제 비교 시 본인 운행 패턴을 기준으로 판단하세요." />

        <ReceiptModal open={showReceipt} onClose={() => setShowReceipt(false)}
          title={`🚗 ${custom.label} ${years}년 소유 비용`}
          footerMessage="차가 주는 자유와 편의가 이 비용보다 크다면, 그건 당신의 라이프스타일에 맞는 합리적 선택입니다.">
          <div className="space-y-2">
            <div className="flex justify-between"><span>차량 가격</span><span>{formatManwon(custom.price)}</span></div>
            <div className="flex justify-between"><span>취득세</span><span>{formatManwon(Math.round(custom.price * 0.07))}</span></div>
            {result.loanInterestTotal > 0 && <div className="flex justify-between"><span>할부 이자</span><span>{formatManwon(result.loanInterestTotal)}</span></div>}
            <div className="flex justify-between"><span>감가상각</span><span>{formatManwon(result.depreciation)}</span></div>
            <div className="flex justify-between"><span>유류비</span><span>{formatManwon(result.fuelTotal)}</span></div>
            <div className="flex justify-between"><span>보험+세금+정비</span><span>{formatManwon((custom.annualInsureTax + custom.annualMaint) * years)}</span></div>
            <div className="flex justify-between text-emerald-600"><span>중고 매도</span><span>-{formatManwon(result.residualValue)}</span></div>
            <div className="border-t border-dashed border-gray-300 dark:border-gray-700 pt-2 mt-2">
              <div className="flex justify-between font-bold"><span>자차 월 비용</span><span>월 {result.carMonthly}만원</span></div>
              <div className="flex justify-between font-bold text-emerald-600"><span>대안 월 비용</span><span>월 {result.realisticMonthly}만원</span></div>
            </div>
            <div className="border-t border-dashed border-gray-300 dark:border-gray-700 pt-2 mt-2">
              <div className="flex justify-between"><span>km당 자차</span><span>{result.carCostPerKm.toLocaleString()}원</span></div>
              <div className="flex justify-between"><span>km당 택시</span><span>{result.taxiCostPerKm.toLocaleString()}원</span></div>
            </div>
            {result.savings > 0 && (
              <div className="border-t border-dashed border-gray-300 dark:border-gray-700 pt-2 mt-2">
                <div className="flex justify-between text-purple-600"><span>나스닥 기회비용</span><span>{formatManwon(result.nasdaq)}</span></div>
              </div>
            )}
          </div>
        </ReceiptModal>
      </main>
    </div>
  );
}
