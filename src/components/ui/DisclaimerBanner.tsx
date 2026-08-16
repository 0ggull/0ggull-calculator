"use client";

import { AlertTriangle } from "lucide-react";

interface DisclaimerBannerProps {
  text?: string;
}

export default function DisclaimerBanner({ text }: DisclaimerBannerProps) {
  return (
    <div className="disclaimer-banner flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <p>
        {text ||
          "본 계산기의 세율·제도·요율은 참고값이며, 법률·정책은 수시로 변경됩니다. 정확한 판단이 필요하면 반드시 전문가와 상담하세요."}
      </p>
    </div>
  );
}
