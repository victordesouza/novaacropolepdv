import { describe, expect, it } from 'vitest';
import { buildSalePayload, getDiscountAmount, isLowStock } from '@/lib/checkout';

describe('checkout utilities', () => {
  it('returns zero discount when mode is none', () => {
    expect(getDiscountAmount({ mode: 'none', subtotal: 120, value: 10 })).toBe(0);
  });

  it('omits undefined discount fields when no discount is selected', () => {
    const payload = buildSalePayload({
      paymentMethod: 'Dinheiro',
      customerName: 'Maria',
      sellerUserId: 'u1',
      sellerUsername: 'maria',
      discountType: undefined,
      discountValue: 0,
      discountAmount: 0,
    });

    expect(payload).not.toHaveProperty('discountType');
    expect(payload).not.toHaveProperty('discountValue');
    expect(payload).toHaveProperty('paymentMethod', 'Dinheiro');
  });

  it('flags low stock only when quantity is below the configured minimum', () => {
    expect(isLowStock(2, 3)).toBe(true);
    expect(isLowStock(3, 3)).toBe(false);
    expect(isLowStock(0, 0)).toBe(false);
  });
});
