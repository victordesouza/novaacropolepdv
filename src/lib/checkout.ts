export type DiscountMode = "none" | "percent" | "currency";

export function getDiscountAmount({
  mode,
  subtotal,
  value,
}: {
  mode: DiscountMode;
  subtotal: number;
  value: number;
}) {
  if (mode === "none") return 0;

  const numericValue = Math.max(0, Number(value) || 0);

  if (mode === "percent") {
    return (subtotal * numericValue) / 100;
  }

  if (mode === "currency") {
    return Math.min(numericValue, subtotal);
  }

  return 0;
}

export function isLowStock(quantity: number, minimum: number) {
  const normalizedMinimum = Math.max(0, Number(minimum) || 0);
  return Number(quantity) < normalizedMinimum;
}

export function buildSalePayload({
  paymentMethod,
  customerName,
  sellerUserId,
  sellerUsername,
  discountType,
  discountValue,
  discountAmount,
}: {
  paymentMethod: string;
  customerName?: string | null;
  sellerUserId: string;
  sellerUsername?: string | null;
  discountType?: string;
  discountValue?: number;
  discountAmount?: number;
}) {
  const payload: Record<string, unknown> = {
    totalAmount: 0,
    paymentMethod,
    customerName: customerName || null,
    sellerUserId,
    sellerUsername: sellerUsername ?? null,
  };

  if (discountType && discountType !== "none") {
    payload.discountType = discountType;
    payload.discountValue = Number(discountValue ?? 0);
    payload.discountAmount = Number(discountAmount ?? 0);
  }

  return payload;
}
