import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Features from './Features';

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: 'en' }),
  useTheme: () => ({ theme: 'light' })
}));

describe('Features page', () => {
  it('renders the documented public features page content and route sections', () => {
    render(
      <MemoryRouter initialEntries={['/features']}>
        <Routes>
          <Route path="/features" element={<Features />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Mekdela Amba University' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'University Asset Management System' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'FEATURES' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Core Benefits' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'System Capabilities' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Connected Asset Management' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Role-Based Access' })).toBeInTheDocument();
    expect(screen.getByText('Centralized Asset Management')).toBeInTheDocument();
    expect(screen.getByText('Asset Registration')).toBeInTheDocument();
    expect(screen.getByText('Authentication & RBAC')).toBeInTheDocument();
    expect(screen.getByText(/Available actions and workflows depend on the asset and the user's assigned role/i)).toBeInTheDocument();
  });
});
