import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AboutUs from './AboutUs';

let mockLanguage = 'en';

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: mockLanguage }),
  useTheme: () => ({ theme: 'light' })
}));

describe('About page public navigation targets', () => {
  beforeEach(() => {
    mockLanguage = 'en';
    HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  it.each([
      ['services', 'Core Benefits'],
      ['features', 'What the System Supports']
  ])('scrolls to the existing %s section', async (sectionId, heading) => {
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

  it('shows one card for each verified feature and the supported roles', () => {
    render(
      <MemoryRouter>
        <AboutUs />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Asset Lifecycle' })).toBeInTheDocument();
    expect(screen.getByRole('list').children).toHaveLength(8);
    expect(screen.getByRole('heading', { name: 'Supported Roles' })).toBeInTheDocument();
    expect(screen.getByText('Department Head')).toBeInTheDocument();
    expect(screen.getByText('College Manager')).toBeInTheDocument();
    const featureCards = [...document.querySelectorAll('#features .about-feature-card')];
    const featureNames = featureCards.map((card) => card.querySelector('.about-service-copy strong')?.textContent);
    expect(featureCards).toHaveLength(15);
    expect(new Set(featureNames).size).toBe(featureNames.length);
    expect(screen.getByText('Asset Registration')).toBeInTheDocument();
    expect(screen.getByText('Disposal', { selector: '.about-service-copy strong' })).toBeInTheDocument();
    expect(screen.getByText('RFID / QR', { selector: '.about-service-copy strong' })).toBeInTheDocument();
    expect(screen.getByText('Audit Logs', { selector: '.about-service-copy strong' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Core Benefits' })).toBeInTheDocument();
      expect(screen.getByText('Centralized Asset Management')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^View service:/ })).not.toBeInTheDocument();
  });

  it('renders the documented About page content and active route heading', () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <Routes>
          <Route path="/about" element={<AboutUs />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'About Us' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mekdela Amba University' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'University Asset Management System' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'About the System' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Our Purpose' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Asset Lifecycle' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What the System Supports' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Supported Roles' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What the System Supports' })).toBeInTheDocument();
  });

  it('renders Amharic content when the existing language context switches language', () => {
    mockLanguage = 'am';

    render(
      <MemoryRouter>
        <AboutUs />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'ስለ ስርዓቱ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'የሚደገፉ ሚናዎች' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'ዋና ጥቅሞች' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'ስርዓቱ የሚደገፈው ነገር' })).toBeInTheDocument();
    expect(screen.getByText('የንብረት ምዝገባ')).toBeInTheDocument();
  });
});