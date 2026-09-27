import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AboutUs from './AboutUs';

let mockLanguage = 'en';

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: mockLanguage }),
  useTheme: () => ({ theme: 'light' })
}));

describe('About page', () => {
  beforeEach(() => {
    mockLanguage = 'en';
    HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  it.each([
    ['services', 'University Asset Management System'],
    ['features', 'Why a centralized system matters'],
    ['lifecycle', 'University asset lifecycle']
  ])('supports the existing %s page anchor', async (sectionId, heading) => {
    render(
      <MemoryRouter initialEntries={[`/about#${sectionId}`]}>
        <Routes>
          <Route path="/about" element={<AboutUs />} />
        </Routes>
      </MemoryRouter>
    );

    const section = document.getElementById(sectionId);
    expect(section).toContainElement(screen.getByRole('heading', { name: heading }));
    await waitFor(() => expect(section.scrollIntoView).toHaveBeenCalledWith({ block: 'start' }));
  });

  it('renders the institutional purpose, vision, mission, governance, and lifecycle', () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <Routes>
          <Route path="/about" element={<AboutUs />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Mekdela Amba University' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'University Asset Management System' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vision' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mission' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Principles of asset governance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Why a centralized system matters' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'University asset lifecycle' })).toBeInTheDocument();
    expect(document.querySelectorAll('#lifecycle li')).toHaveLength(9);
    expect(document.querySelector('.about-page main')).toBeNull();
    expect(screen.getByText('Financial Records')).toBeInTheDocument();
    expect(screen.getByText(/not a required linear sequence/i)).toBeInTheDocument();
  });

  it('renders the existing Amharic language selection', () => {
    mockLanguage = 'am';

    render(
      <MemoryRouter>
        <AboutUs />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ራዕይ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ተልዕኮ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'የንብረት አስተዳደር መርሆዎች' })).toBeInTheDocument();
    expect(screen.getByText('የገንዘብ መዝገቦች')).toBeInTheDocument();
  });
});