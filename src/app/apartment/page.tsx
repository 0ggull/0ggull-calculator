"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import { Home, Receipt, TrendingDown, TrendingUp, Calculator, AlertCircle } from "lucide-react";
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

const HOUSING_TABS = [
  { key: "single", label: "1주택자", emoji: "🏠", subtitle: "비과세 대상" },
  { key: "multi", label: "다주택자", emoji: "🏢", subtitle: "일반세율" },
];

// 취득세 구간 (1주택 기준, 2024)
function calcAcquisitionTax(price: number, housing: HousingCount): number {
  // price: 만원
  const won = price * 10000;
  let rate: number;
  if (housing === "multi") {
    // 다주택 중과 (조정대상지역 2주택 8%, 3주택 12% → 평균 8% 가정)
    rate = 0.08;
  } else {
    // 1주택
    if (won <= 600000000) rate = 0.01;        // 6억 이하 1%
    else if (won <= 900000000) rate = 0.022;  // 6~9억 1~3% (평균 약 2.2%)
    else rate = 0.03;                          // 9억 초과 3%
  }
  // 취득세 + 지방교육세 합산 (근사)
  return Math.round(price * rate * 1.1); // 지방교육세 10% 가산
}

// 양도소득세 계산 (단순화)
function calcCapitalGainsTax(
  buyPrice: number,     // 만원
  sellPrice: number,    // 만원
  holdYears: number,
  housing: HousingCount,
  deductibleExpense: number // 필요경비 (인테리어 등, 만원)
): number {
  const gain = sellPrice - buyPrice - deductibleExpense;
  if (gain <= 0) return 0;

  // 1주택 비과세: 2년 이상 보유 + 12억 이하 → 비과세
  if (housing === "single" && holdYears >= 2) {
    const won = sellPrice * 10000;
    if (won <= 1200000000) return 0; // 12억 이하 비과세
    // 12억 초과분만 과세
    const taxableRatio = (won - 1200000000) / won;
    const taxableGain = gain * taxableRatio;
    return calcProgressiveTax(taxableGain, holdYears);
  }

  // 다주택 또는 1주택 2년 미만
  if (housing === "single" && holdYears < 2) {
    // 1년 미만 70%, 1~2년 60%
    const rate = holdYears < 1 ? 0.70 : 0.60;
    return Math.round(gain * rate);
  }

  // 다주택 중과 (기본세율 + 20~30%p) → 단순 50% 가정
  return Math.round(gain * 0.50);
}

// 누진세 + 장기보유특별공제
function calcProgressiveTax(taxableGain: number, holdYears: number): number {
  // 장기보유특별공제 (1주택: 연 8%, 최대 80%)
  const ltDeduction = Math.min(holdYears * 0.08, 0.80);
  const afterDeduction = taxableGain * (1 - ltDeduction);
  if (afterDeduction <= 0) return 0;

  // 기본공제 250만원
  const base = Math.max(0, afterDeduction - 250);

  // 누진세율 (2024 기준)
  const brackets = [
    { limit: 1400, rate: 0.06 },
    { limit: 5000, rate: 0.15 },
    { limit: 8800, rate: 0.24 },
    { limit: 15000, rate: 0.35 },
    { limit: 30000, rate: 0.38 },
    { limit: 50000, rate: 0.40 },
    { limit: 100000, rate: 0.42 },
    { limit: Infinity, rate: 0.45 },
  ];

  let tax = 0;
  let remaining = base;
  let prev = 0;
  for (const b of brackets) {
    const chunk = Math.min(remaining, b.limit - prev);
    if (chunk <= 0) break;
    tax += chunk * b.rate;
    remaining -= chunk;
    prev = b.limit;
  }

  return Math.round(tax);
}

// 매도 중개보수 (상한요율)
function calcBrokerFee(price: number): number {
  const won = price * 10000;
  let rate: number;
  if (won < 200000000) rate = 0.005;
  else if (won < 600000000) rate = 0.004;
  else if (won < 900000000) rate = 0.005;
  else rate = 0.009; // 9억 이상 (협의, 최대 0.9%)
  // 실무적으로 0.4~0.5% 선에서 협의 → 보수적 0.4%
  rate = Math.min(rate, 0.005);
  return Math.round(price * rate);
}

// ─── 메인 계산 ───────────────────────────────────────────
interface AptResult {
  acquisitionTax: number;
  legalFee: number;          // 법무사+채권 할인
  buyBroker: number;         // 매수 복비
  totalInterest: number;     // 총 대출이자
  totalPropertyTax: number;  // 재산세+종부세
  sellBroker: number;        // 매도 복비 (BEP 기준)
  capitalGainsTax: number;   // 양도세 (BEP 기준)
  deductibleExpense: number;
  bepSellPrice: number;      // 손익분기 매도가
  bepGainPercent: number;    // BEP까지 상승률
  totalSunkCost: number;     // 총 매몰비용 (매수가로 매도 시 손해)
  samePriceLoss: number;     // 산 가격 그대로 매도 시 손해액
  opportunityCost: number;   // 자기자본 예금 기회비용
}

function calculate(
  buyPrice: number,
  loanAmount: number,
  loanRate: number,
  holdYears: number,
  housing: HousingCount,
  interiorCost: number,
  annualPropertyTax: number
): AptResult {
  const acquisitionTax = calcAcquisitionTax(buyPrice, housing);
  const legalFee = 150; // 법무사 + 채권 할인 약 150만
  const buyBroker = calcBrokerFee(buyPrice);

  // 대출이자 (원리금 상환 X, 이자만 계산 - 보수적)
  const totalInterest = Math.round(loanAmount * loanRate * holdYears);

  // 재산세
  const totalPropertyTax = annualPropertyTax * holdYears;

  // 자기자본 기회비용: (매수가 - 대출 + 취득세 + 법무사 + 복비 + 인테리어) × 예금금리
  const equity = buyPrice - loanAmount + acquisitionTax + legalFee + buyBroker + interiorCost;
  const opportunityCost = Math.round(equity * (Math.pow(1 + DEPOSIT_RATE, holdYears) - 1));

  // BEP 계산 (반복법 - 매도가를 올려가며 순이익 0이 되는 점 탐색)
  // 먼저 대략적인 매몰비용 합산으로 초기 추정
  const roughSunk = acquisitionTax + legalFee + buyBroker + totalInterest + totalPropertyTax + interiorCost;
  let bepSellPrice = buyPrice + roughSunk; // 매몰비용만큼 더한 값에서 시작

  // 이분법으로 정확한 BEP 찾기
  let lo = buyPrice;
  let hi = buyPrice + roughSunk * 3; // 넉넉히 3배까지
  for (let i = 0; i < 100; i++) {
    const mid = Math.round((lo + hi) / 2);
    const sellBroker = calcBrokerFee(mid);
    const cgt = calcCapitalGainsTax(buyPrice, mid, holdYears, housing, interiorCost);
    const totalCosts = acquisitionTax + legalFee + buyBroker + totalInterest + totalPropertyTax + sellBroker + cgt + interiorCost;
    const netProfit = mid - buyPrice - totalCosts;
    if (Math.abs(netProfit) < 5) { bepSellPrice = mid; break; } // 5만원 이내 수렴
    if (netProfit < 0) lo = mid;
    else { hi = mid; bepSellPrice = mid; }
  }

  const sellBroker = calcBrokerFee(bepSellPrice);
  const capitalGainsTax = calcCapitalGainsTax(buyPrice, bepSellPrice, holdYears, housing, interiorCost);
  const bepGainPercent = ((bepSellPrice - buyPrice) / buyPrice) * 100;

  // 산 가격 그대로 팔면?
  const samePriceSellBroker = calcBrokerFee(buyPrice);
  const samePriceLoss = acquisitionTax + legalFee + buyBroker + totalInterest + totalPropertyTax + samePriceSellBroker + interiorCost;

  const totalSunkCost = acquisitionTax + legalFee + buyBroker + totalInterest + totalPropertyTax + interiorCost;

  return {
    acquisitionTax,
    legalFee,
    buyBroker,
    totalInterest,
    totalPropertyTax,
    sellBroker,
    capitalGainsTax,
    deductibleExpense: interiorCost,
    bepSellPrice,
    bepGainPercent,
    totalSunkCost,
    samePriceLoss,
    opportunityCost,
  };
}

// ─── 컴포넌트 ───────────────────────────────────────────
export default function ApartmentCalculator() {
  const [buyPrice, setBuyPrice] = useState(120000);   // 만원 (12억)
  const [loanAmount, setLoanAmount] = useState(60000); // 6억
  const [loanRate, setLoanRate] = useState(4.0);
  const [holdYears, setHoldYears] = useState(3);
  const [housing, setHousing] = useState<HousingCount>("single");
  const [interiorCost, setInteriorCost] = useState(2000); // 2천만
  const [annualPropertyTax, setAnnualPropertyTax] = useState(200); // 연 200만
  const [showReceipt, setShowReceipt] = useState(false);

  const result = useMemo(
    () => calculate(buyPrice, loanAmount, loanRate / 100, holdYears, housing, interiorCost, annualPropertyTax),
    [buyPrice, loanAmount, loanRate, holdYears, housing, interiorCost, annualPropertyTax]
  );

  const costBreakdown = [
    { name: "취득세", value: result.acquisitionTax, color: "#ef4444" },
    { name: "법무사·채권", value: result.legalFee, color: "#f97316" },
    { name: "매수 복비", value: result.buyBroker, color: "#eab308" },
    { name: "대출이자", value: result.totalInterest, color: "#8b5cf6" },
    { name: "재산세", value: result.totalPropertyTax, color: "#06b6d4" },
    { name: "인테리어", value: result.deductibleExpense, color: "#10b981" },
    { name: "매도 복비", value: result.sellBroker, color: "#f43f5e" },
  ];

  const holdOptions = [
    { key: "2", label: "2년" },
    { key: "3", label: "3년" },
    { key: "5", label: "5년" },
    { key: "7", label: "7년" },
    { key: "10", label: "10년" },
  ];

  return (
    <div className="min-h-screen">
      <Header title="아파트 매도 BEP" showBack />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 주택 수 */}
        <TabSelector tabs={HOUSING_TABS} active={housing} onChange={(k) => setHousing(k as HousingCount)} />

        {/* 핵심 입력 */}
        <div className="card p-5 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">매수가</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={buyPrice}
                onChange={(e) => setBuyPrice(Math.max(1000, Number(e.target.value) || 0))}
                className="input-field flex-1"
                step={1000}
              />
              <span className="text-sm text-gray-500 shrink-0">만원 ({formatManwon(buyPrice)})</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">대출 금액</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={loanAmount}
                onChange={(e) => setLoanAmount(Math.max(0, Math.min(buyPrice, Number(e.target.value) || 0)))}
                className="input-field flex-1"
                step={1000}
              />
              <span className="text-sm text-gray-500 shrink-0">만원 ({formatManwon(loanAmount)})</span>
            </div>
          </div>
          <Slider
            label="대출 금리"
            value={loanRate}
            min={2.0}
            max={8.0}
            step={0.1}
            unit="%"
            onChange={setLoanRate}
            formatDisplay={(v) => `연 ${v.toFixed(1)}%`}
          />
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">보유 예정 기간</p>
            <div className="flex gap-2 flex-wrap">
              {holdOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setHoldYears(Number(opt.key))}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all
                    ${holdYears === Number(opt.key)
                      ? "bg-brand-50 dark:bg-brand-950 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300"
                      : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 상세 설정 */}
        <details className="card overflow-hidden">
          <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            🏗️ 상세 설정 직접 수정
          </summary>
          <div className="px-5 pb-5 grid grid-cols-2 gap-3 border-t border-gray-100 dark:border-gray-800 pt-4">
            <NumberInput label="인테리어/자본적 지출" value={interiorCost} onChange={setInteriorCost} hint="샷시·확장 등 양도세 경비 인정" />
            <NumberInput label="연간 재산세+종부세" value={annualPropertyTax} onChange={setAnnualPropertyTax} />
          </div>
        </details>

        {/* 핵심 결과 - BEP */}
        <div className="card p-6 bg-gradient-to-br from-sky-50 to-indigo-50 dark:from-sky-950/20 dark:to-indigo-950/20 border-sky-200 dark:border-sky-800/50 space-y-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-brand-500" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">이 집은 최소</p>
          </div>
          <p className="text-3xl md:text-4xl font-bold text-brand-600 dark:text-brand-400">
            {formatManwon(result.bepSellPrice)}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            이상에 팔아야 진짜 본전입니다. (매수가 대비 <span className="font-semibold text-amber-600">{formatPercent(result.bepGainPercent)}</span> 상승 필요)
          </p>
        </div>

        {/* 산 가격 그대로 팔면 */}
        <div className="card p-5 bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/20 dark:to-red-950/20 border-rose-200 dark:border-rose-800/50">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-rose-500" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              만약 산 가격 그대로 ({formatManwon(buyPrice)}) 매도한다면?
            </p>
          </div>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            -{formatManwon(result.samePriceLoss)} 손해
          </p>
          <p className="text-xs text-gray-500 mt-1">취득세 + 복비 + 이자 + 재산세 + 인테리어 비용이 고스란히 손실</p>
        </div>

        {/* 결과 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ResultCard
            icon={<TrendingDown className="w-5 h-5" />}
            label="총 매몰비용 (세금+이자+수수료)"
            value={formatManwon(result.totalSunkCost)}
            sublabel={`${holdYears}년 보유 기준`}
            accent="red"
          />
          <ResultCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="자기자본 기회비용 (예금 연 4%)"
            value={formatManwon(result.opportunityCost)}
            sublabel={`자기자본 ${formatManwon(buyPrice - loanAmount)}을 예금에 넣었다면`}
            accent="purple"
          />
        </div>

        {/* 비용 분해 차트 */}
        <div className="card p-5">
          <p className="section-title mb-4">📊 매몰비용 내역</p>
          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costBreakdown} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
                <XAxis type="number" tickFormatter={(v: number) => `${v}만`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(v: number) => formatManwon(v)} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {costBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 상세 내역 테이블 */}
        <div className="card p-5 space-y-3">
          <p className="section-title">🧾 비용 상세</p>
          <div className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
            <div className="flex justify-between py-2">
              <span className="text-gray-600 dark:text-gray-400">취득세 + 지방교육세</span>
              <span className="font-medium">{formatManwon(result.acquisitionTax)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600 dark:text-gray-400">법무사 + 국민주택채권 할인</span>
              <span className="font-medium">{formatManwon(result.legalFee)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600 dark:text-gray-400">매수 중개보수</span>
              <span className="font-medium">{formatManwon(result.buyBroker)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600 dark:text-gray-400">대출이자 ({holdYears}년)</span>
              <span className="font-medium text-purple-600">{formatManwon(result.totalInterest)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600 dark:text-gray-400">재산세·종부세 ({holdYears}년)</span>
              <span className="font-medium">{formatManwon(result.totalPropertyTax)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600 dark:text-gray-400">인테리어/자본적 지출</span>
              <span className="font-medium">{formatManwon(result.deductibleExpense)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600 dark:text-gray-400">매도 중개보수 (BEP가 기준)</span>
              <span className="font-medium">{formatManwon(result.sellBroker)}</span>
            </div>
            {result.capitalGainsTax > 0 && (
              <div className="flex justify-between py-2">
                <span className="text-gray-600 dark:text-gray-400">양도소득세</span>
                <span className="font-medium text-rose-600">{formatManwon(result.capitalGainsTax)}</span>
              </div>
            )}
            <div className="flex justify-between py-3 font-bold text-base border-t-2 border-gray-200 dark:border-gray-700 mt-2">
              <span>BEP 매도가</span>
              <span className="text-brand-600 dark:text-brand-400">{formatManwon(result.bepSellPrice)}</span>
            </div>
          </div>
        </div>

        {/* 숨은 비용 */}
        <div className="card p-5 space-y-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">💡 자주 간과하는 숨은 비용</p>
          <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>이사비 (용달~포장이사: 80~300만원) × 매수+매도 = 2회</li>
            <li>입주 후 하자보수 및 가전·가구 교체 비용 (500~2,000만원)</li>
            <li>관리비 인상분 (장기수선충당금, 난방비 상승)</li>
            <li>대출 중도상환 수수료 (고정금리 시 원금의 1~1.5%)</li>
            <li>매도 시 집 보여주기 위한 스테이징·청소 비용 (50~200만원)</li>
            <li>공실 리스크: 매도까지 걸리는 기간의 기회비용</li>
            <li>부동산 정책 변동 리스크 (대출규제, 세율 변경)</li>
          </ul>
        </div>

        {/* 영수증 */}
        <button onClick={() => setShowReceipt(true)} className="btn-primary w-full">
          <Receipt className="w-4 h-4" /> SNS 공유용 영수증 보기
        </button>

        <DisclaimerBanner text="양도소득세는 2026년 8월 기준 세법을 단순화하여 적용한 참고값입니다. 비거주 1주택 장특공 폐지안 논의 중이며, 실제 세액은 거주기간·조정대상지역 여부 등에 따라 크게 달라지므로 반드시 세무사와 상담하세요." />

        <ReceiptModal
          open={showReceipt}
          onClose={() => setShowReceipt(false)}
          title={`🏠 아파트 ${formatManwon(buyPrice)} 매도 BEP`}
          footerMessage="내 집이 주는 안정감과 자산 형성의 가치까지 포함하면, 숫자만으로 판단할 수 없는 것들이 있습니다."
        >
          <div className="space-y-2">
            <div className="flex justify-between"><span>매수가</span><span>{formatManwon(buyPrice)}</span></div>
            <div className="flex justify-between"><span>취득세</span><span>{formatManwon(result.acquisitionTax)}</span></div>
            <div className="flex justify-between"><span>대출이자 ({holdYears}년)</span><span>{formatManwon(result.totalInterest)}</span></div>
            <div className="flex justify-between"><span>재산세</span><span>{formatManwon(result.totalPropertyTax)}</span></div>
            <div className="flex justify-between"><span>중개수수료 (매수+매도)</span><span>{formatManwon(result.buyBroker + result.sellBroker)}</span></div>
            <div className="flex justify-between"><span>인테리어</span><span>{formatManwon(interiorCost)}</span></div>
            <div className="border-t border-dashed border-gray-300 dark:border-gray-700 pt-2 mt-2">
              <div className="flex justify-between font-bold"><span>본전 매도가</span><span>{formatManwon(result.bepSellPrice)}</span></div>
              <div className="flex justify-between text-xs text-gray-500"><span>필요 상승률</span><span>{formatPercent(result.bepGainPercent)}</span></div>
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
