import React from 'react';
import { render, screen } from '@testing-library/react';
import AboutUs from './AboutUs';

let mockLanguage = 'en';

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: mockLanguage }),
  useTheme: () => ({ theme: 'light' })
}));

describe('About page', () => {
  beforeEach(() => {
    mockLanguage = 'en';
  });

  it('renders the university information without imagery or asset-system content', () => {
    render(<AboutUs />);

    expect(screen.getByRole('heading', { level: 1, name: 'Mekdela Amba University' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'About Us' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vision' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mission' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Core Values' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Our Commitment' })).toBeInTheDocument();
    expect(screen.getByText('Academic Excellence')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(11);
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('svg')).toBeNull();
    expect(screen.queryByText(/asset management system/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/centralized records|movement and responsibility|verification and care|reporting and oversight/i)).not.toBeInTheDocument();
  });

  it('renders university information in Amharic when selected', () => {
    mockLanguage = 'am';

    render(<AboutUs />);

    expect(screen.getByRole('heading', { level: 1, name: 'መቅደላ አምባ ዩኒቨርሲቲ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ስለ እኛ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ራዕይ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ተልዕኮ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ዋና እሴቶች' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ቁርጠኝነታችን' })).toBeInTheDocument();
  });
});