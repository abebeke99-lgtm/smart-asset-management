import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Features from './Features';

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: 'en' }),
  useTheme: () => ({ theme: 'light' })
}));

describe('Features page', () => {
  it('renders the requested public feature set and bilingual page structure', () => {
    render(
      <MemoryRouter initialEntries={['/features']}>
        <Routes>
          <Route path="/features" element={<Features />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Features' })).toBeInTheDocument();
    expect(screen.getByText('Powerful digital capabilities for secure, transparent, and efficient university asset management.')).toBeInTheDocument();
    expect(screen.getByText('Asset Management')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Real-time Asset Tracking' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Inventory Control' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'RFID / QR' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Role-Based Access Control' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Asset Lifecycle Management' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Maintenance Management' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Transfer Management' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Financial Records' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reports & Analytics' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Audit Logs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'English ↔ አማርኛ' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Secure Authentication' })).toBeInTheDocument();
    expect(screen.getByText(/Role-based access and authenticated workflows are controlled by the system/i)).toBeInTheDocument();
  });
});
