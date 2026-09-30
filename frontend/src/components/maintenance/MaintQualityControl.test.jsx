import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import QualityControl from './MaintTestingQuality';

const originalFetch = global.fetch;

beforeEach(() => {
  localStorage.setItem('token', 'quality-control-test-token');
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [] }),
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  localStorage.clear();
});

test('loads the quality control screen and sends its persisted session token', async () => {
  render(<QualityControl />);

  expect(await screen.findByRole('heading', { name: 'Quality Control' })).toBeInTheDocument();
  expect(await screen.findByText('No quality control reviews found.')).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    '/api/maintenance/quality-control',
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer quality-control-test-token' }),
    })
  ));
});