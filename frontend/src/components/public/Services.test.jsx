import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UIProvider } from '../../contexts/UiContext';
import Services from './Services';

describe('Services page', () => {
  it('renders the documented services page content and the key service categories', () => {
    render(
      <MemoryRouter>
        <UIProvider>
          <Services />
        </UIProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Mekdela Amba University/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /University Asset Management System/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Services/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Asset Management Services/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Financial Services/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Tracking & Reporting/i })).toBeInTheDocument();
    expect(screen.getByText(/Asset Registration/i)).toBeInTheDocument();
    expect(screen.getByText(/RFID \/ QR/i)).toBeInTheDocument();
    expect(screen.getByText(/Authentication & RBAC/i)).toBeInTheDocument();
  });
});
