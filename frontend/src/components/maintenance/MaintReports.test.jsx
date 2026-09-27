import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MaintReports from './MaintReports';
import { getMaintenance, getMaintenanceDashboard, getRepairHistory, getTechnicians } from '../../services/maintenanceApi';

jest.mock('../../contexts/UiContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../../services/maintenanceApi', () => ({
  getMaintenance: jest.fn(),
  getMaintenanceDashboard: jest.fn(),
  getRepairHistory: jest.fn(),
  getTechnicians: jest.fn(),
}));

beforeEach(() => {
  getMaintenance.mockResolvedValue([]);
  getMaintenanceDashboard.mockResolvedValue({});
  getRepairHistory.mockResolvedValue({ records: [], stats: {} });
  getTechnicians.mockResolvedValue([]);
});

test('selected report period is sent to the persisted repair history API', async () => {
  render(<MaintReports />);

  await waitFor(() => expect(getRepairHistory).toHaveBeenCalled());
  fireEvent.change(await screen.findByRole('combobox'), { target: { value: '30days' } });

  await waitFor(() => expect(getRepairHistory).toHaveBeenLastCalledWith(expect.objectContaining({ period: '30days' })));
});