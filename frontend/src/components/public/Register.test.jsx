import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { UIProvider, useLanguage } from '../../contexts/UiContext';
import Register from './Register';

const LanguageControl = () => {
  const { setLanguage } = useLanguage();
  return <button type="button" onClick={() => setLanguage('am')}>Amharic</button>;
};

describe('Register page translations', () => {
  beforeEach(() => localStorage.clear());

  it('updates the page copy immediately when the language changes', () => {
    render(
      <UIProvider>
        <Register />
        <LanguageControl />
      </UIProvider>
    );

    expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByText('Component placeholder')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Amharic' }));

    expect(screen.getByRole('heading', { name: 'ይመዝገቡ' })).toBeInTheDocument();
    expect(screen.getByText('የክፍሉ ቦታ ያዥ')).toBeInTheDocument();
  });
});
