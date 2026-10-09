import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { UIProvider, useLanguage } from '../../../contexts/UiContext';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import StatusBadge from './StatusBadge';
import UserAvatar from '../UserAvatar';

const LanguageControl = () => {
  const { language, setLanguage } = useLanguage();
  return (
    <button type="button" onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}>
      Switch language
    </button>
  );
};

describe('shared UI translations', () => {
  beforeEach(() => localStorage.clear());

  it('updates shared empty, error, and status labels without remounting', () => {
    render(
      <UIProvider>
        <LanguageControl />
        <EmptyState />
        <ErrorState onRetry={() => {}} />
        <StatusBadge status="in_progress" />
        <UserAvatar user={{}} />
      </UIProvider>
    );

    expect(screen.getByText('Nothing to show')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByLabelText('User avatar')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }));

    expect(screen.getByText('ምንም የሚታይ ነገር የለም')).toBeInTheDocument();
    expect(screen.getByText('እንደገና ሞክር')).toBeInTheDocument();
    expect(screen.getByText('በሂደት ላይ')).toBeInTheDocument();
    expect(screen.getByLabelText('የተጠቃሚ መገለጫ ምስል')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('am');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('preserves an explicit label while translating the recognized status value', () => {
    render(
      <UIProvider>
        <LanguageControl />
        <StatusBadge status="approved">approved</StatusBadge>
      </UIProvider>
    );

    expect(screen.getByText('Approved')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }));
    expect(screen.getByText('ጸድቋል')).toBeInTheDocument();
  });
});