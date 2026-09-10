import { describe, expect, it } from 'vitest';
import { formatQuantity, parseQuantity, scaleQuantity } from '@/lib/fractions';

describe('fractions', () => {
  it('renders human-friendly values', () => { expect(formatQuantity(1.5)).toBe('1½'); expect(formatQuantity(2 / 3)).toBe('⅔'); expect(formatQuantity(2.6666667)).toBe('2⅔'); });
  it('parses mixed and unicode fractions', () => { expect(parseQuantity('1 1/3')).toBeCloseTo(4 / 3); expect(parseQuantity('2½')).toBe(2.5); });
  it('always scales from the original value', () => { expect(scaleQuantity(4 / 3, 10, 20)).toBeCloseTo(8 / 3); expect(scaleQuantity(4 / 3, 10, 5)).toBeCloseTo(2 / 3); });
});
