"use client";

import { useRef, ReactNode } from "react";
import { X, Download, Share2 } from "lucide-react";

interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footerMessage: string;
}

export default function ReceiptModal({ open, onClose, title, children, footerMessage }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(receiptRef.current, {
      backgroundColor: null,
      scale: 2,
    });
    const link = document.createElement("a");
    link.download = `0GGULL_${title.replace(/\s/g, "_")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleShare = async () => {
    if (!receiptRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(receiptRef.current, { backgroundColor: null, scale: 2 });
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      if (navigator.share) {
        const file = new File([blob], "0ggull-result.png", { type: "image/png" });
        await navigator.share({ files: [file], title: "0GGULL 계산 결과" });
      } else {
        handleDownload();
      }
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 rounded-t-2xl">
          <h3 className="font-semibold text-sm">영수증 미리보기</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Receipt Content */}
        <div ref={receiptRef} className="p-6 bg-white dark:bg-gray-950">
          {/* Dotted top border - receipt style */}
          <div className="border-b-2 border-dashed border-gray-300 dark:border-gray-700 pb-4 mb-4">
            <h2 className="text-center text-lg font-bold">0GGULL</h2>
            <p className="text-center text-xs text-gray-500 mt-1">{title}</p>
            <p className="text-center text-xs text-gray-400 mt-0.5 font-mono">
              {new Date().toLocaleDateString("ko-KR")}
            </p>
          </div>

          {/* Items */}
          <div className="space-y-3 font-mono text-sm border-b-2 border-dashed border-gray-300 dark:border-gray-700 pb-4 mb-4">
            {children}
          </div>

          {/* Footer message */}
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 leading-relaxed px-2">
            {footerMessage}
          </p>

          <p className="text-center text-[10px] text-gray-300 dark:text-gray-600 mt-4">
            0GGULL
          </p>
        </div>

        {/* Action buttons */}
        <div className="sticky bottom-0 flex gap-2 p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-t border-gray-100 dark:border-gray-800 rounded-b-2xl">
          <button onClick={handleDownload} className="btn-primary flex-1">
            <Download className="w-4 h-4" /> 저장
          </button>
          <button onClick={handleShare} className="btn-ghost flex-1 border border-gray-200 dark:border-gray-700">
            <Share2 className="w-4 h-4" /> 공유
          </button>
        </div>
      </div>
    </div>
  );
}
