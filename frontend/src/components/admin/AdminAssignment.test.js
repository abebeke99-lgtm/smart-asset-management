import { getVisiblePageNumbers } from './AdminAssignment';

describe('getVisiblePageNumbers', () => {
  it('returns each page once when there are fewer than five pages', () => {
    expect(getVisiblePageNumbers(1, 3)).toEqual([1, 2, 3]);
  });

  it('keeps the visible page range centered when possible', () => {
    expect(getVisiblePageNumbers(5, 10)).toEqual([3, 4, 5, 6, 7]);
  });

  it('clamps the visible range to the final page', () => {
    expect(getVisiblePageNumbers(10, 10)).toEqual([6, 7, 8, 9, 10]);
  });
});
