import React from "react";

const ICON_MAP: Record<string, { src: string; alt: string }> = {
  PIX: {
    src: "https://img.icons8.com/fluency/48/pix.png",
    alt: "Pix",
  },
  CREDIT_CARD: {
    src: "https://img.icons8.com/fluency/48/bank-card-back-side.png",
    alt: "Cartão",
  },
  DEBIT_CARD: {
    src: "https://img.icons8.com/fluency/48/bank-card-back-side.png",
    alt: "Cartão",
  },
  CASH: {
    src: "https://img.icons8.com/fluency/48/money.png",
    alt: "Dinheiro",
  },
  BANK_TRANSFER: {
    src: "https://img.icons8.com/fluency/48/bank-card-back-side.png",
    alt: "Transferência",
  },
};

export function PaymentMethodIcon({
  method,
  size = 20,
  className = "",
}: {
  method: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const key = (method || "PIX").toUpperCase();
  const icon = ICON_MAP[key] || ICON_MAP.PIX;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={icon.src}
      alt={icon.alt}
      width={size}
      height={size}
      className={`inline-block shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
