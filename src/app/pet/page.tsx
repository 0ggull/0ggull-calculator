"use client";

import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Receipt, TrendingUp, PiggyBank, Heart } from "lucide-react";
import Header from "@/components/ui/Header";
import TabSelector from "@/components/ui/TabSelector";
import NumberInput from "@/components/ui/NumberInput";
import CheckOption from "@/components/ui/CheckOption";
import ResultCard from "@/components/ui/ResultCard";
import Slider from "@/components/ui/Slider";
import ReceiptModal from "@/components/ui/ReceiptModal";
import DisclaimerBanner from "@/components/ui/DisclaimerBanner";
import { formatManwon, SP500_RATE, NASDAQ_RATE, INFLATION_RATE } from "@/lib/finance";

// ─── 타입 & 상수 ─────────────────────────────────────────
type PetType = "small_dog" | "medium_dog" | "large_dog" | "cat";
type FoodGrade = "budget" | "standard" | "premium";

interface PetPreset {
  lifespan: number;
  initialVaccination: number;
  neutering: number;
  initialSupplies: number;
  monthlyFood: number;
  monthlyParasite: number;
  monthlyGrooming: number;
  monthlySupplies: number;
  monthlyInsurance: number;
  annualVetAfter8: number;
  funeralCost: number;
}

const PET_TABS = [
  { key: "small_dog", label: "소형견", emoji: "🐕", subtitle: "10kg 미만" },
  { key: "medium_dog", label: "중형견", emoji: "🐶", subtitle: "10~25kg" },
  { key: "large_dog", label: "대형견", emoji: "🦮", subtitle: "25kg+" },
  { key: "cat", label: "고양이", emoji: "🐱", subtitle: "전 체급" },
];

const PRESETS: Record<PetType, PetPreset> = {
  small_dog: { lifespan: 15, initialVaccination: 36, neutering: 30, initialSupplies: 25, monthlyFood: 5, monthlyParasite: 1.5, monthlyGrooming: 4, monthlySupplies: 3, monthlyInsurance: 4.5, annualVetAfter8: 100, funeralCost: 40 },
  medium_dog: { lifespan: 14, initialVaccination: 42, neutering: 45, initialSupplies: 35, monthlyFood: 9, monthlyParasite: 2.5, monthlyGrooming: 6, monthlySupplies: 4, monthlyInsurance: 6, annualVetAfter8: 150, funeralCost: 50 },
  large_dog: { lifespan: 12, initialVaccination: 50, neutering: 65, initialSupplies: 50, monthlyFood: 18, monthlyParasite: 4, monthlyGrooming: 12, monthlySupplies: 6, monthlyInsurance: 8.5, annualVetAfter8: 250, funeralCost: 70 },
  cat: { lifespan: 15, initialVaccination: 30, neutering: 25, initialSupplies: 45, monthlyFood: 6, monthlyParasite: 1.5, monthlyGrooming: 0, monthlySupplies: 4.5, monthlyInsurance: 4, annualVetAfter8: 120, funeralCost: 40 },
};

const FOOD_GRADES: { key: FoodGrade; label: string; mult: number }[] = [
  { key: "budget", label: "하급 (50%)", mult: 0.5 },
  { key: "standard", label: "중급 (100%)", mult: 1.0 },
  { key: "premium", label: "고급 (180%)", mult: 1.8 },
];

interface ExtraOpt {
  id: string;
  label: string;
  desc: string;
  pets: PetType[] | "all";
  perYear?: number;
  oneTime?: number;
  startAge?: number;
  triggerAge?: number;
}

const EXTRAS: ExtraOpt[] = [
  { id: "patella", label: "슬개골 탈구 수술 (양측)", desc: "3세 시점 +200만원 · 강아지 전용", pets: ["small_dog", "medium_dog", "large_dog"], oneTime: 200, triggerAge: 3 },
  { id: "dental", label: "정기 스케일링 & 치과 치료", desc: "5세 이후 매년 +35만원", pets: "all", perYear: 35, startAge: 5 },
  { id: "skin", label: "만성 피부/외이염 관리비", desc: "전 연령 매년 +40만원", pets: "all", perYear: 40, startAge: 1 },
  { id: "urinary", label: "하부요로계/신부전 비상 치료", desc: "7세 시점 +150만원 · 고양이 전용", pets: ["cat"], oneTime: 150, triggerAge: 7 },
];

// ─── 계산 로직 ───────────────────────────────────────────
function calculate(preset: PetPreset, foodMult: number, enabledExtras: string[], petType: PetType) {
  const { lifespan } = preset;
  const initial = preset.initialVaccination + preset.neutering + preset.initialSupplies;
  const monthlyBase = preset.monthlyFood * foodMult + preset.monthlyParasite + preset.monthlyGrooming + preset.monthlySupplies + preset.monthlyInsurance;
  const annualBase = monthlyBase * 12;

  const yearly: { age: number; costNom: number; costReal: number; cumNom: number; cumReal: number; sp500: number; nasdaq: number }[] = [];
  let cumNom = 0, cumReal = 0, sp500 = 0, nasdaq = 0;
  const mSP = SP500_RATE / 12, mNQ = NASDAQ_RATE / 12;

  for (let age = 1; age <= lifespan; age++) {
    let cost = annualBase;
    if (age === 1) cost += initial;
    if (age >= 8) cost += preset.annualVetAfter8;
    if (age === lifespan) cost += preset.funeralCost;

    for (const ext of EXTRAS) {
      if (!enabledExtras.includes(ext.id)) continue;
      if (ext.pets !== "all" && !ext.pets.includes(petType)) continue;
      if (ext.perYear && ext.startAge && age >= ext.startAge) cost += ext.perYear;
      if (ext.oneTime && ext.triggerAge && age === ext.triggerAge) cost += ext.oneTime;
    }

    const inflFactor = Math.pow(1 + INFLATION_RATE, age - 1);
    const costReal = cost * inflFactor;
    cumNom += cost;
    cumReal += costReal;

    const monthlyInv = cost / 12;
    for (let m = 0; m < 12; m++) {
      sp500 = sp500 * (1 + mSP) + monthlyInv;
      nasdaq = nasdaq * (1 + mNQ) + monthlyInv;
    }

    yearly.push({ age, costNom: Math.round(cost), costReal: Math.round(costReal), cumNom: Math.round(cumNom), cumReal: Math.round(cumReal), sp500: Math.round(sp500), nasdaq: Math.round(nasdaq) });
  }

  return { yearly, totalNom: Math.round(cumNom), totalReal: Math.round(cumReal), sp500Final: Math.round(sp500), nasdaqFinal: Math.round(nasdaq), lifespan };
}

// ─── 컴포넌트 ───────────────────────────────────────────
export default function PetCalculator() {
  const [petType, setPetType] = useState<PetType>("small_dog");
  const [foodGrade, setFoodGrade] = useState<FoodGrade>("standard");
  const [enabledExtras, setEnabledExtras] = useState<string[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);

  // 사용자 커스텀 가능한 프리셋 (탭 변경 시 리셋)
  const [custom, setCustom] = useState<PetPreset>(PRESETS.small_dog);

  const handlePetChange = (key: string) => {
    const pt = key as PetType;
    setPetType(pt);
    setCustom(PRESETS[pt]);
    // 적용 불가능 옵션 제거
    setEnabledExtras((prev) =>
      prev.filter((id) => {
        const ext = EXTRAS.find((e) => e.id === id);
        return ext && (ext.pets === "all" || ext.pets.includes(pt));
      })
    );
  };

  const foodMult = FOOD_GRADES.find((f) => f.key === foodGrade)!.mult;
  const result = useMemo(() => calculate(custom, foodMult, enabledExtras, petType), [custom, foodMult, enabledExtras, petType]);

  const chartData = result.yearly.map((y) => ({
    name: `${y.age}세`,
    "누적 지출": y.cumNom,
    "S&P500": y.sp500,
    "나스닥": y.nasdaq,
  }));

  const monthlyAvg = Math.round(result.totalNom / (result.lifespan * 12));

  return (
    <div className="min-h-screen">
      <Header title="반려동물 생애비용" showBack />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 동물 타입 선택 */}
        <TabSelector tabs={PET_TABS} active={petType} onChange={handlePetChange} />

        {/* 사료 등급 */}
        <div className="card p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">사료 등급</p>
          <div className="flex gap-2">
            {FOOD_GRADES.map((g) => (
              <button
                key={g.key}
                onClick={() => setFoodGrade(g.key)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all
                  ${foodGrade === g.key
                    ? "bg-brand-50 dark:bg-brand-950 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300"
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
                  }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* 상세 비용 입력 (접이식) */}
        <details className="card overflow-hidden">
          <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            💰 상세 비용 직접 수정 (고급 설정)
          </summary>
          <div className="px-5 pb-5 grid grid-cols-2 md:grid-cols-3 gap-3 border-t border-gray-100 dark:border-gray-800 pt-4">
            <NumberInput label="초기 접종비" value={custom.initialVaccination} onChange={(v) => setCustom({ ...custom, initialVaccination: v })} />
            <NumberInput label="중성화 비용" value={custom.neutering} onChange={(v) => setCustom({ ...custom, neutering: v })} />
            <NumberInput label="초기 용품비" value={custom.initialSupplies} onChange={(v) => setCustom({ ...custom, initialSupplies: v })} />
            <NumberInput label="월 사료비 (중급)" value={custom.monthlyFood} onChange={(v) => setCustom({ ...custom, monthlyFood: v })} />
            <NumberInput label="월 기생충약" value={custom.monthlyParasite} onChange={(v) => setCustom({ ...custom, monthlyParasite: v })} step={0.5} />
            <NumberInput label="월 미용비" value={custom.monthlyGrooming} onChange={(v) => setCustom({ ...custom, monthlyGrooming: v })} />
            <NumberInput label="월 소모품" value={custom.monthlySupplies} onChange={(v) => setCustom({ ...custom, monthlySupplies: v })} />
            <NumberInput label="펫보험 월" value={custom.monthlyInsurance} onChange={(v) => setCustom({ ...custom, monthlyInsurance: v })} step={0.5} />
            <NumberInput label="8세+ 연간 병원비" value={custom.annualVetAfter8} onChange={(v) => setCustom({ ...custom, annualVetAfter8: v })} />
            <NumberInput label="장례비" value={custom.funeralCost} onChange={(v) => setCustom({ ...custom, funeralCost: v })} />
            <NumberInput label="기본 수명" value={custom.lifespan} onChange={(v) => setCustom({ ...custom, lifespan: Math.max(1, Math.min(20, v)) })} unit="년" />
          </div>
        </details>

        {/* 추가 수술/치료 옵션 */}
        <div className="card p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">🏥 추가 수술 · 치료 옵션</p>
          <div className="space-y-2">
            {EXTRAS.map((ext) => {
              const available = ext.pets === "all" || ext.pets.includes(petType);
              return (
                <CheckOption
                  key={ext.id}
                  id={ext.id}
                  label={ext.label}
                  description={ext.desc}
                  disabled={!available}
                  checked={enabledExtras.includes(ext.id)}
                  onChange={(checked) => {
                    setEnabledExtras((prev) =>
                      checked ? [...prev, ext.id] : prev.filter((id) => id !== ext.id)
                    );
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* 결과 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ResultCard
            icon={<PiggyBank className="w-5 h-5" />}
            label={`${result.lifespan}년간 실제 지출 총액`}
            value={formatManwon(result.totalNom)}
            sublabel={`물가상승 반영 시 ${formatManwon(result.totalReal)}`}
            accent="red"
          />
          <ResultCard
            icon={<Heart className="w-5 h-5" />}
            label="월평균 지출"
            value={`${monthlyAvg.toLocaleString()}만원`}
            sublabel={`= 월 ${Math.round(monthlyAvg * 10000).toLocaleString()}원`}
            accent="amber"
          />
          <ResultCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="S&P500 적립 시 (연 8%)"
            value={formatManwon(result.sp500Final)}
            sublabel="매월 동일 금액 적립 투자 가정"
            accent="blue"
          />
          <ResultCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="나스닥 적립 시 (연 12%)"
            value={formatManwon(result.nasdaqFinal)}
            sublabel="매월 동일 금액 적립 투자 가정"
            accent="purple"
          />
        </div>

        {/* 차트 */}
        <div className="card p-5">
          <p className="section-title mb-4">📈 연령별 누적 비교</p>
          <div className="h-72 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v: number) => `${v >= 10000 ? `${(v / 10000).toFixed(0)}억` : `${v}`}`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatManwon(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="누적 지출" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="S&P500" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="나스닥" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 숨은 비용 안내 */}
        <div className="card p-5 space-y-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">💡 자주 간과하는 숨은 비용</p>
          <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>반려동물 동반 여행·펜션 추가요금 (1박 2~5만원 추가)</li>
            <li>출장/여행 시 펫시터·호텔 비용 (1일 3~8만원)</li>
            <li>반려동물 가능 주거지 프리미엄 (보증금·월세 10~20% ↑)</li>
            <li>노견/노묘 시기 간병 시간 = 부모 커리어 기회비용</li>
            <li>예상치 못한 응급 수술비 (100~500만원 일시 지출)</li>
          </ul>
        </div>

        {/* 영수증 버튼 */}
        <button onClick={() => setShowReceipt(true)} className="btn-primary w-full">
          <Receipt className="w-4 h-4" /> SNS 공유용 영수증 보기
        </button>

        <DisclaimerBanner text="본 계산기의 비용은 2026년 기준 평균값이며, 지역·병원·브랜드에 따라 크게 달라질 수 있습니다. 펫보험 보장 범위와 실비 적용 여부에 따라 실 부담액이 변동됩니다." />

        {/* 영수증 모달 */}
        <ReceiptModal
          open={showReceipt}
          onClose={() => setShowReceipt(false)}
          title={`${PET_TABS.find((t) => t.key === petType)?.emoji} ${PET_TABS.find((t) => t.key === petType)?.label} ${result.lifespan}년 생애비용`}
          footerMessage="이 돈보다 15년간 주는 행복이 더 크다면, 당신은 준비된 최고의 반려인입니다. 🐾"
        >
          <div className="space-y-2">
            <div className="flex justify-between"><span>초기 비용</span><span>{formatManwon(custom.initialVaccination + custom.neutering + custom.initialSupplies)}</span></div>
            <div className="flex justify-between"><span>월 고정 지출</span><span>{Math.round(custom.monthlyFood * foodMult + custom.monthlyParasite + custom.monthlyGrooming + custom.monthlySupplies + custom.monthlyInsurance)}만원/월</span></div>
            <div className="flex justify-between"><span>8세+ 연간 병원비</span><span>{custom.annualVetAfter8}만원/년</span></div>
            <div className="flex justify-between"><span>장례비</span><span>{custom.funeralCost}만원</span></div>
            <div className="border-t border-dashed border-gray-300 dark:border-gray-700 pt-2 mt-2">
              <div className="flex justify-between font-bold"><span>총 지출 (명목)</span><span>{formatManwon(result.totalNom)}</span></div>
              <div className="flex justify-between font-bold"><span>총 지출 (인플레 반영)</span><span>{formatManwon(result.totalReal)}</span></div>
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
