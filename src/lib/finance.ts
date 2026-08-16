// ─────────────────────────────────────────────────────────
//  공통 금융 계산 유틸리티
// ─────────────────────────────────────────────────────────

/** 월 적립식 투자 미래가치 (FV) */
export function monthlyInvestFV(
  monthlyAmount: number,
  annualRate: number,
  years: number
): number {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return monthlyAmount * n;
  return monthlyAmount * ((Math.pow(1 + r, n) - 1) / r);
}

/** 거치 + 월 적립 복합 미래가치 */
export function lumpSumPlusMonthlyFV(
  lumpSum: number,
  monthlyAmount: number,
  annualRate: number,
  years: number
): number {
  const r = annualRate / 12;
  const n = years * 12;
  const lumpFV = lumpSum * Math.pow(1 + r, n);
  const monthlyFV = r === 0 ? monthlyAmount * n : monthlyAmount * ((Math.pow(1 + r, n) - 1) / r);
  return lumpFV + monthlyFV;
}

/** 연 복리 적용 */
export function compoundAnnual(principal: number, rate: number, years: number): number {
  return principal * Math.pow(1 + rate, years);
}

/** 인플레이션 반영 비용 (n년차) */
export function inflationAdjust(baseCost: number, inflationRate: number, year: number): number {
  return baseCost * Math.pow(1 + inflationRate, year - 1);
}

// ─────────────────────────────────────────────────────────
//  숫자 포맷팅
// ─────────────────────────────────────────────────────────

/** 만원 단위로 표시 (예: 12345 → "1억 2,345만원") */
export function formatManwon(manwon: number): string {
  const abs = Math.abs(manwon);
  const sign = manwon < 0 ? "-" : "";
  if (abs >= 10000) {
    const eok = Math.floor(abs / 10000);
    const rem = Math.round(abs % 10000);
    if (rem === 0) return `${sign}${eok}억원`;
    return `${sign}${eok}억 ${rem.toLocaleString()}만원`;
  }
  return `${sign}${Math.round(abs).toLocaleString()}만원`;
}

/** 원 단위로 표시 (예: 85000000 → "8,500만원") */
export function formatWon(won: number): string {
  return formatManwon(Math.round(won / 10000));
}

/** 원 단위를 억/만 혼합 표시 */
export function formatWonFull(won: number): string {
  const abs = Math.abs(won);
  const sign = won < 0 ? "-" : "";
  if (abs >= 100000000) {
    const eok = Math.floor(abs / 100000000);
    const manRem = Math.round((abs % 100000000) / 10000);
    if (manRem === 0) return `${sign}${eok}억원`;
    return `${sign}${eok}억 ${manRem.toLocaleString()}만원`;
  }
  if (abs >= 10000) {
    return `${sign}${Math.round(abs / 10000).toLocaleString()}만원`;
  }
  return `${sign}${Math.round(abs).toLocaleString()}원`;
}

/** 퍼센트 표시 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

/** 숫자에 콤마 추가 */
export function addCommas(n: number): string {
  return Math.round(n).toLocaleString();
}

// ─────────────────────────────────────────────────────────
//  금융 상수
// ─────────────────────────────────────────────────────────
export const SP500_RATE = 0.08;
export const NASDAQ_RATE = 0.12;
export const INFLATION_RATE = 0.025;
export const DEPOSIT_RATE = 0.04;
