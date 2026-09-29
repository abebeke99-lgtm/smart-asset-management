import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Contact from './Contact';
import { UiProvider } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';

jest.mock('../../utils/api', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));

const renderContact = async () => {
  const view = render(
    <MemoryRouter>
      <UiProvider>
        <Contact />
      </UiProvider>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.queryByText(/Loading contact details|የግንኙነት መረጃ በመጫን/)).not.toBeInTheDocument());
  return view;
};

describe('Contact', () => {
  beforeEach(() => {
    localStorage.clear();
    apiClient.get.mockReset().mockResolvedValue({ data: { success: true, data: {} } });
    apiClient.post.mockReset();
  });

  const fillForm = () => {
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.org' } });
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Asset assistance' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Please help me with this asset record.' } });
  };

  it('shows university information and a labeled public message form without unconfigured details', async () => {
    await renderContact();

    expect(screen.getByRole('heading', { name: 'Contact' })).toBeInTheDocument();
    expect(screen.getAllByText('Mekdela Amba University')).toHaveLength(2);
    expect(screen.getAllByRole('heading', { name: 'University Asset Management System' })).toHaveLength(2);
    expect(screen.getByText('Send a message to the system administration team.')).toBeInTheDocument();
    expect(screen.queryByText(/Address:|Phone:|@/i)).not.toBeInTheDocument();
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(screen.getByRole('form')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeRequired();
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByRole('button', { name: /Send message/i })).toBeInTheDocument();
  });

  it('renders headings, labels, placeholders, and validation in Amharic from the shared language setting', async () => {
    localStorage.setItem('language', 'am');
    await renderContact();

    expect(screen.getByRole('heading', { name: 'ያግኙን' })).toBeInTheDocument();
    expect(screen.getByLabelText('ስም')).toHaveAttribute('placeholder', 'ስምዎ');
    expect(screen.getByLabelText('ኢሜይል')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'መልዕክት ይላኩ' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'መልዕክት ይላኩ' }));
    expect(screen.getByText('ስምዎን ያስገቡ (ከ2 እስከ 100 ቁምፊዎች)።')).toBeInTheDocument();
  });

  it('translates confirmed success and delivery error states into Amharic', async () => {
    localStorage.setItem('language', 'am');
    apiClient.post.mockResolvedValueOnce({ data: { success: true, delivery: 'sent' } });
    await renderContact();
    fireEvent.change(screen.getByLabelText('ስም'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText('ኢሜይል'), { target: { value: 'user@example.org' } });
    fireEvent.change(screen.getByLabelText('ርዕስ'), { target: { value: 'Asset help' } });
    fireEvent.change(screen.getByLabelText('መልዕክት'), { target: { value: 'Please help me with this asset record.' } });
    fireEvent.click(screen.getByRole('button', { name: 'መልዕክት ይላኩ' }));
    expect(await screen.findByRole('status')).toHaveTextContent('መልዕክትዎ በተሳካ ሁኔታ ተልኳል።');

    apiClient.post.mockRejectedValueOnce({ response: { status: 503 } });
    fireEvent.change(screen.getByLabelText('ስም'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText('ኢሜይል'), { target: { value: 'user@example.org' } });
    fireEvent.change(screen.getByLabelText('ርዕስ'), { target: { value: 'Asset help' } });
    fireEvent.change(screen.getByLabelText('መልዕክት'), { target: { value: 'Please help me with this asset record.' } });
    fireEvent.click(screen.getByRole('button', { name: 'መልዕክት ይላኩ' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('የመልዕክት መላኪያ አልተዋቀረም። ቆይተው እንደገና ይሞክሩ።');
  });

  it('validates email and message length before requesting the API', async () => {
    await renderContact();
    fillForm();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'x'.repeat(5001) } });
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }));

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Your message must be between 20 and 5,000 characters.')).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('clears the form only after the API confirms email delivery', async () => {
    apiClient.post.mockResolvedValue({ data: { success: true, delivery: 'sent' } });
    await renderContact();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('Your message has been submitted successfully.');
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(apiClient.post).toHaveBeenCalledWith('/contact', {
      name: 'Test User',
      email: 'user@example.org',
      subject: 'Asset assistance',
      message: 'Please help me with this asset record.'
    });
  });

  it('keeps entered values and hides technical details when delivery fails', async () => {
    apiClient.post.mockRejectedValue({ response: { status: 502, data: { message: 'SMTP credentials rejected' } } });
    await renderContact();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Your message could not be delivered. Your entries have been kept.');
    expect(screen.getByLabelText('Name')).toHaveValue('Test User');
    expect(screen.queryByText(/SMTP credentials rejected/i)).not.toBeInTheDocument();
  });

  it('shows a clear network error and preserves form values', async () => {
    apiClient.post.mockRejectedValue({ code: 'ERR_NETWORK' });
    await renderContact();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The service could not be reached. Check your connection and try again.');
    expect(screen.getByLabelText('Email')).toHaveValue('user@example.org');
  });

  it('shows timeout and server validation errors without clearing entered values', async () => {
    apiClient.post.mockRejectedValueOnce({ response: { status: 400, data: { errors: { email: 'Invalid email' } } } });
    await renderContact();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Please review the highlighted fields and try again.');
    expect(screen.getByLabelText('Name')).toHaveValue('Test User');

    apiClient.post.mockRejectedValueOnce({ response: { status: 504 } });
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Message delivery timed out. Your message was not confirmed; please try again.');
  });
});