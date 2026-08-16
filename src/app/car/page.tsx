"use client";

import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Car, Bus, TrendingUp, Receipt, Fuel, ParkingCircle, Banknote } from "lucide-react";
import Header from "@/components/ui/Header";
import TabSelector from "@/components/ui/TabSelector";
import Slider from "@/components/ui/Slider";
import NumberInput from "@/components/ui/NumberInput";
import ResultCard from "@/components/ui/ResultCard";
import ReceiptModal from "@/components/ui/ReceiptModal";
import DisclaimerBanner from "@/components/ui/DisclaimerBanner";
import { formatManwon, formatWonFull, SP500_RATE, NASDAQ_RATE } from "@/lib/finance";

// ─── 타입 & 상수 ─────────────────────────────────────────
type CarType = "avante" | "sorento" | "grandeur" | "tesla";

interface CarPreset {
  label: string;
  price: number;        // 만원
  depRate: number;      // 연 감가율
  efficiency: number;   // km/L 또는 km/kWh
  effUnit: string;
  fuelPrice: number;    // 원/L 또는 원/kWh
  annualInsureTax: number; // 만원
  annualMaint: number;     // 만원
  isEV: boolean;
}

const CAR_TABS = [
  { key: "avante", label: "아반떼/경차급", emoji: "🚗", subtitle: "2,500만원" },
  { key: "sorento", label: "쏘렌토/스포티지급", emoji: "🚙", subtitle: "4,000만원" },
  { key: "grandeur", label: "그랜저/제네시스", emoji: "🏎️", subtitle: "6,000만원" },
  { key: "tesla", label: "테슬라/전기차", emoji: "⚡", subtitle: "5,500만원" },
];

const PRESETS: Record<CarType, CarPreset> = {
  avante: { label: "아반떼/경차급", price: 2600, depRate: 0.10, efficiency: 14, effUnit: "km/L", fuelPrice: 1860, annualInsureTax: 125, annualMaint: 65, isEV: false },
  sorento: { label: "쏘렌토/스포티지급", price: 4200, depRate: 0.09, efficiency: 11, effUnit: "km/L", fuelPrice: 1860, annualInsureTax: 155, annualMaint: 95, isEV: false },
  grandeur: { label: "그랜저/제네시스급", price: 6300, depRate: 0.10, efficiency: 9, effUnit: "km/L", fuelPrice: 1860, annualInsureTax: 215, annualMaint: 135, isEV: false },
  tesla: { label: "테슬라/전기차", price: 5800, depRate: 0.11, efficiency: 5.5, effUnit: "km/kWh", fuelPrice: 350, annualInsureTax: 150, annualMaint: 45, isEV: true },
};

// 택시 요금 계산 (서울 기준 2026)
const TAXI_BASE_FARE = 4800;     // 기본요금 (1.6km)
const TAXI_BASE_DIST = 1.6;      // 기본거리 km
const TAXI_PER_131M = 100;       // 131m당 100원
const TAXI_COST_PER_KM = TAXI_PER_131M / 0.131; // ≈ 763원/km (거리요금만)

function taxiCostForKm(totalKm: number): number {
  // 평균 1회 탑승거리 5km 가정, 기본요금이 매 탑승마다 적용
  const avgTripKm = 5;
  const numTrips = totalKm / avgTripKm;
  const costPerTrip = TAXI_BASE_FARE + Math.max(0, avgTripKm - TAXI_BASE_DIST) * TAXI_COST_PER_KM;
  return numTrips * costPerTrip;
}

// ─── 계산 로직 ───────────────────────────────────────────
interface CalcResult {
  carMonthly: number;           // 자차 월 비용 (만원)
  carTotal: number;             // 자차 총 비용 (만원)
  taxiOnlyMonthly: number;      // 100% 택시 월 비용 (만원)
  taxiOnlyTotal: number;
  realisticMonthly: number;     // 현실적 대안 월 비용 (만원)
  realisticTotal: number;
  savings: number;              // 월 절약액 (자차 - 현실적)
  sp500: number;                // 차액 적립 S&P500
  nasdaq: number;               // 차액 적립 나스닥
  yearlyData: { year: number; carCum: number; realisticCum: number; sp500: number; nasdaq: number }[];
  depreciation: number;         // 총 감가상각 (만원)
  fuelTotal: number;            // 총 유류비 (만원)
  residualValue: number;        // 잔존가치 (만원)
  carCostPerKm: number;         // 자차 km당 비용 (원)
  taxiCostPerKm: number;        // 택시 km당 비용 (원)
}

function calculate(
  preset: CarPreset,
  years: number,
  annualKm: number,
  monthlyParking: number, // 만원
): CalcResult {
  const { price, depRate, efficiency, fuelPrice, annualInsureTax, annualMaint } = preset;

  // 취득세 (7%)
  const acquisitionTax = price * 0.07;

  // 감가상각 (정률법)
  let residual = price;
  let totalDep = 0;
  for (let y = 0; y < years; y++) {
    const dep = residual * depRate;
    totalDep += dep;
    residual -= dep;
  }

  // 연간 유류비/전기비 (만원)
  const annualFuelWon = (annualKm / efficiency) * fuelPrice; // 원
  const annualFuel = annualFuelWon / 10000; // 만원

  // 연간 주차/통행료
  const annualParking = monthlyParking * 12;

  // 자차 총 비용 (잔존가치 차감 — 나중에 중고로 팔 수 있으니까)
  const totalCarCost = acquisitionTax + totalDep + (annualInsureTax + annualMaint + annualFuel + annualParking) * years - residual;
  const monthlyCarCost = totalCarCost / (years * 12);

  // 자차 km당 비용
  const carCostPerKm = Math.round((totalCarCost * 10000) / (annualKm * years)); // 원/km

  // 100% 택시 (연간 비용)
  // 평균 1회 탑승거리 5km 가정, 연간 총 주행거리 기준
  const annualTaxiCost = taxiCostForKm(annualKm) / 10000; // 만원
  const monthlyTaxi = annualTaxiCost / 12;
  const taxiCostPerKm = Math.round(taxiCostForKm(annualKm) / annualKm); // 원/km

  // 현실적 대안: 평일 대중교통 80% + 택시 20% + 주말 쏘카 월 2회
  const monthlyTransport = 9;   // 대중교통 (만원) - 2026 지하철 1,550원 기준
  const monthlyTaxiPart = 16;   // 택시 (만원) - 비/회식 등
  const monthlySocar = 16;      // 쏘카/렌터카 (만원)
  const realisticMonthly = monthlyTransport + monthlyTaxiPart + monthlySocar;
  const realisticTotal = realisticMonthly * years * 12;

  // 월 절약액
  const savings = monthlyCarCost - realisticMonthly;

  // 투자 기회비용 (차액 적립)
  const monthlySavingsForInvest = Math.max(0, savings);
  const mSP = SP500_RATE / 12;
  const mNQ = NASDAQ_RATE / 12;

  let sp500 = 0, nasdaq = 0;
  const yearlyData: CalcResult["yearlyData"] = [];
  let carCum = acquisitionTax; // 취득세는 초기 비용
  let residualForChart = price;

  for (let y = 1; y <= years; y++) {
    // 해당 연도 감가
    const yearDep = residualForChart * depRate;
    residualForChart -= yearDep;
    carCum += annualInsureTax + annualMaint + annualFuel + annualParking + yearDep;

    const realisticCum = realisticMonthly * y * 12;

    // 12개월 적립
    for (let m = 0; m < 12; m++) {
      sp500 = sp500 * (1 + mSP) + monthlySavingsForInvest;
      nasdaq = nasdaq * (1 + mNQ) + monthlySavingsForInvest;
    }

    yearlyData.push({
      year: y,
      carCum: Math.round(carCum),
      realisticCum: Math.round(realisticCum),
      sp500: Math.round(sp500),
      nasdaq: Math.round(nasdaq),
    });
  }

  return {
    carMonthly: Math.round(monthlyCarCost * 10) / 10,
    carTotal: Math.round(totalCarCost),
    taxiOnlyMonthly: Math.round(monthlyTaxi * 10) / 10,
    taxiOnlyTotal: Math.round(annualTaxiCost * years),
    realisticMonthly,
    realisticTotal,
    savings: Math.round(savings * 10) / 10,
    sp500: Math.round(sp500),
    nasdaq: Math.round(nasdaq),
    yearlyData,
    depreciation: Math.round(totalDep),
    fuelTotal: Math.round(annualFuel * years),
    residualValue: Math.round(residual),
    carCostPerKm,
    taxiCostPerKm,
  };
}

// ─── 컴포넌트 ───────────────────────────────────────────
export default function CarCalculator() {
  const [carType, setCarType] = useState<CarType>("avante");
  const [years, setYears] = useState(5);
  const [annualKm, setAnnualKm] = useState(15000);
  const [monthlyParking, setMonthlyParking] = useState(10); // 만원
  const [showReceipt, setShowReceipt] = useState(false);

  // 커스텀 가능
  const [custom, setCustom] = useState(PRESETS.avante);

  const handleCarChange = (key: string) => {
    const ct = key as CarType;
    setCarType(ct);
    setCustom(PRESETS[ct]);
  };

  const result = useMemo(() => calculate(custom, years, annualKm, monthlyParking), [custom, years, annualKm, monthlyParking]);

  const chartData = result.yearlyData.map((d) => ({
    name: `${d.year}년`,
    "자차 누적비용": d.carCum,
    "대안 누적비용": d.realisticCum,
    "차액 S&P500": d.sp500,
    "차액 나스닥": d.nasdaq,
  }));

  return (
    <div className="min-h-screen">
      <Header title="자동차 vs 대중교통" showBack />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 차종 선택 */}
        <TabSelector tabs={CAR_TABS} active={carType} onChange={handleCarChange} />

        {/* 슬라이더 */}
        <div className="card p-5 space-y-5">
          <Slider label="보유 기간" value={years} min={1} max={10} unit="년" onChange={setYears} />
          <Slider
            label="연간 주행거리"
            value={annualKm}
            min={5000}
            max={30000}
            step={1000}
            unit="km"
            onChange={setAnnualKm}
            formatDisplay={(v) => `${(v / 10000).toFixed(1)}만km`}
          />
          <Slider label="월 주차비/통행료" value={monthlyParking} min={0} max={30} unit="만원" onChange={setMonthlyParking} />
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
            <NumberInput label={custom.isEV ? "전기요금" : "유류 단가"} value={custom.fuelPrice} onChange={(v) => setCustom({ ...custom, fuelPrice: v })} unit="원" />
            <NumberInput label="연간 보험+세금" value={custom.annualInsureTax} onChange={(v) => setCustom({ ...custom, annualInsureTax: v })} />
            <NumberInput label="연간 정비비" value={custom.annualMaint} onChange={(v) => setCustom({ ...custom, annualMaint: v })} />
          </div>
        </details>

        {/* 핵심 결과 */}
        <div className="card p-6 bg-gradient-to-br from-rose-50 to-amber-50 dark:from-rose-950/20 dark:to-amber-950/20 border-rose-200 dark:border-rose-800/50">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">차를 소유하면 매달 (중고 매도 가정 후에도)</p>
          <p className="text-3xl md:text-4xl font-bold text-rose-600 dark:text-rose-400">
            월 {result.carMonthly.toLocaleString()}만원
          </p>
          <p className="text-sm text-gray-500 mt-1">이 사라집니다. ({years}년 총 {formatManwon(result.carTotal)}, {years}년 후 중고매도 {formatManwon(result.residualValue)} 차감 반영)</p>
        </div>

        {/* km당 비용 비교 */}
        <div className="card p-5 space-y-3">
          <p className="section-title">📏 km당 비용 직접 비교</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-xl text-center">
              <p className="text-xs text-gray-500 mb-1">자차 (감가+유류+보험+주차 포함)</p>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{result.carCostPerKm.toLocaleString()}원</p>
              <p className="text-xs text-gray-400">/ km</p>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-center">
              <p className="text-xs text-gray-500 mb-1">택시 (평균 5km 탑승 기준)</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{result.taxiCostPerKm.toLocaleString()}원</p>
              <p className="text-xs text-gray-400">/ km</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            * 택시 계산식: 기본요금 4,800원(1.6km) + 초과거리 131m당 100원 (≈km당 763원). 평균 1회 탑승 5km 가정.
          </p>
        </div>

        {/* 비교 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ResultCard
            icon={<Car className="w-5 h-5" />}
            label="100% 택시 전환 시 (충격요법)"
            value={`월 ${result.taxiOnlyMonthly.toLocaleString()}만원`}
            sublabel={`연 ${(annualKm / 10000).toFixed(1)}만km를 전부 택시로 타면`}
            accent="amber"
          />
          <ResultCard
            icon={<Bus className="w-5 h-5" />}
            label="현실적 대안 (대중교통+택시+쏘카)"
            value={`월 ${result.realisticMonthly}만원`}
            sublabel="평일 대중교통 80% + 택시 20% + 주말 렌터카"
            accent="green"
          />
        </div>

        {/* 절약 & 기회비용 */}
        {result.savings > 0 && (
          <div className="card p-6 bg-gradient-to-br from-emerald-50 to-sky-50 dark:from-emerald-950/20 dark:to-sky-950/20 border-emerald-200 dark:border-emerald-800/50 space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              대중교통+택시+쏘카로 바꾸면 매월 <span className="font-bold text-emerald-600 dark:text-emerald-400">{result.savings.toLocaleString()}만원</span> 절약
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-white/60 dark:bg-gray-900/60 rounded-xl">
                <p className="text-xs text-gray-500">차액을 S&P500에 넣으면 ({years}년)</p>
                <p className="text-xl font-bold text-brand-600 dark:text-brand-400">{formatManwon(result.sp500)}</p>
              </div>
              <div className="p-3 bg-white/60 dark:bg-gray-900/60 rounded-xl">
                <p className="text-xs text-gray-500">차액을 나스닥에 넣으면 ({years}년)</p>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{formatManwon(result.nasdaq)}</p>
              </div>
            </div>
          </div>
        )}

        {/* 비용 상세 분해 */}
        <div className="card p-5 space-y-3">
          <p className="section-title">🧾 자차 비용 분해</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">취득세 (7%)</span>
              <span className="font-medium">{formatManwon(Math.round(custom.price * 0.07))}</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">{years}년 총 감가</span>
              <span className="font-medium">{formatManwon(result.depreciation)}</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">총 유류비</span>
              <span className="font-medium">{formatManwon(result.fuelTotal)}</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">보험+세금</span>
              <span className="font-medium">{formatManwon(custom.annualInsureTax * years)}</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">정비비</span>
              <span className="font-medium">{formatManwon(custom.annualMaint * years)}</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">주차/통행료</span>
              <span className="font-medium">{formatManwon(monthlyParking * 12 * years)}</span>
            </div>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700 font-semibold">
            <span>{years}년 후 잔존가치</span>
            <span className="text-brand-600 dark:text-brand-400">{formatManwon(result.residualValue)}</span>
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
                <YAxis tickFormatter={(v: number) => `${v >= 10000 ? `${(v / 10000).toFixed(0)}억` : `${v}`}`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatManwon(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="자차 누적비용" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="대안 누적비용" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="차액 S&P500" stroke="#0ea5e9" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="차액 나스닥" stroke="#8b5cf6" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 숨은 비용 */}
        <div className="card p-5 space-y-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">💡 자주 간과하는 숨은 비용</p>
          <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>사고 시 보험료 할증 (무사고 3년 vs 사고 이력 → 연 30~80만원 차이)</li>
            <li>세차·광택·틴팅 유지비 (연 30~60만원)</li>
            <li>주말 나들이 충동 지출 증가 (차 있으면 평균 소비 15~20% ↑ 연구 결과)</li>
            <li>교통 벌금·범칙금 (연 평균 10~20만원)</li>
            <li>중고 매도 시 실제 감가가 정률 이상인 경우 多 (첫 1년 20~30% 하락)</li>
            <li>차량 구매를 위한 할부 이자 (3년 3.5%→ 추가 부담 약 180만원)</li>
          </ul>
        </div>

        {/* 영수증 */}
        <button onClick={() => setShowReceipt(true)} className="btn-primary w-full">
          <Receipt className="w-4 h-4" /> SNS 공유용 영수증 보기
        </button>

        <DisclaimerBanner text="택시 요금은 서울 기준 2026년 요율이며, 지역·시간대에 따라 달라집니다. 유류비는 2026년 8월 전국 평균 기준입니다. 감가상각은 차량 상태·사고 유무·시장 상황에 영향을 받습니다." />

        <ReceiptModal
          open={showReceipt}
          onClose={() => setShowReceipt(false)}
          title={`🚗 ${custom.label} ${years}년 소유 비용`}
          footerMessage="차가 주는 자유와 편의가 이 비용보다 크다면, 그건 당신의 라이프스타일에 맞는 선택입니다."
        >
          <div className="space-y-2">
            <div className="flex justify-between"><span>차량 가격</span><span>{formatManwon(custom.price)}</span></div>
            <div className="flex justify-between"><span>취득세 (7%)</span><span>{formatManwon(Math.round(custom.price * 0.07))}</span></div>
            <div className="flex justify-between"><span>{years}년 감가상각</span><span>-{formatManwon(result.depreciation)}</span></div>
            <div className="flex justify-between"><span>총 유류비</span><span>{formatManwon(result.fuelTotal)}</span></div>
            <div className="flex justify-between"><span>보험+세금+정비</span><span>{formatManwon((custom.annualInsureTax + custom.annualMaint) * years)}</span></div>
            <div className="flex justify-between"><span>주차/통행료</span><span>{formatManwon(monthlyParking * 12 * years)}</span></div>
            <div className="border-t border-dashed border-gray-300 dark:border-gray-700 pt-2 mt-2">
              <div className="flex justify-between font-bold"><span>자차 월 환산</span><span>월 {result.carMonthly}만원</span></div>
              <div className="flex justify-between font-bold text-emerald-600"><span>대안 월 비용</span><span>월 {result.realisticMonthly}만원</span></div>
            </div>
            {result.savings > 0 && (
              <div className="border-t border-dashed border-gray-300 dark:border-gray-700 pt-2 mt-2">
                <div className="flex justify-between text-purple-600 dark:text-purple-400"><span>나스닥 기회비용 ({years}년)</span><span>{formatManwon(result.nasdaq)}</span></div>
              </div>
            )}
          </div>
        </ReceiptModal>
      </main>
    </div>
  );
}
