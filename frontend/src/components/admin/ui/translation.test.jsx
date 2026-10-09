import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { UIProvider, useLanguage } from '../../../contexts/UiContext';
import ConfirmDialog from './ConfirmDialog';
import DataTable from './DataTable';
import FilterBar from './FilterBar';

const LanguageControl = () => {
  const { language, setLanguage } = useLanguage();
  return <button type="button" onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}>Switch language</button>;
};

describe('shared admin UI translations', () => {
  beforeEach(() => localStorage.clear());

  it('translates table, filter, pagination, modal, and confirmation controls when language changes', () => {
    render(
      <UIProvider>
        <LanguageControl />
        <FilterBar search="" onSearchChange={() => {}} onReset={() => {}} />
        <DataTable columns={[{ key: 'name', label: 'Name' }]} rows={[]} />
        <ConfirmDialog open message="Continue?" onClose={() => {}} onConfirm={() => {}} />
      </UIProvider>
    );

    expect(screen.getByRole('region', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search records...' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Data table' })).toBeInTheDocument();
    expect(screen.getByText('Showing 0–0 of 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Confirm action' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }));

    expect(screen.getByRole('region', { name: 'ማጣሪያዎች' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'መዝገቦችን ይፈልጉ...' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'የውሂብ ሰንጠረዥ' })).toBeInTheDocument();
    expect(screen.getByText('ከ0 ውስጥ 0–0 በማሳየት ላይ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ቀዳሚ ገጽ' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'እርምጃውን ያረጋግጡ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'መገናኛውን ዝጋ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ሰርዝ' })).toBeInTheDocument();
  });
});
