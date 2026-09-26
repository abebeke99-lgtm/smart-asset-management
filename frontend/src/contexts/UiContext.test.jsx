import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { UIProvider, useLanguage } from './UiContext';

describe('UiProvider language', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults unsupported stored languages to English', () => {
    localStorage.setItem('language', 'fr');

    const { result } = renderHook(() => useLanguage(), { wrapper: UIProvider });

    expect(result.current.language).toBe('en');
    expect(localStorage.getItem('language')).toBe('en');
  });

  it('switches between supported languages and persists the selection', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper: UIProvider });

    act(() => result.current.setLanguage('am'));
    expect(result.current.language).toBe('am');
    expect(localStorage.getItem('language')).toBe('am');

    act(() => result.current.setLanguage('en'));
    expect(result.current.language).toBe('en');
    expect(localStorage.getItem('language')).toBe('en');

    act(() => result.current.setLanguage('fr'));
    expect(result.current.language).toBe('en');
    expect(localStorage.getItem('language')).toBe('en');
  });
});