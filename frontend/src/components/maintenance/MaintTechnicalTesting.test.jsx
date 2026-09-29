import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MaintTechnicalTesting from './MaintTechnicalTesting';
import apiClient from '../../services/apiClient';
import { createMaintenanceTest, getMaintenanceTestOptions, getMaintenanceTests } from '../../services/maintenanceApi';

jest.mock('../../services/apiClient', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../../services/maintenanceApi', () => ({
  getMaintenanceTests: jest.fn(),
  getMaintenanceTestOptions: jest.fn(),
  createMaintenanceTest: jest.fn(),
  createMaintenanceRetest: jest.fn(),
  startMaintenanceTest: jest.fn(),
  completeMaintenanceTest: jest.fn(),
  sendMaintenanceTestToQC: jest.fn(),
  returnMaintenanceTestToService: jest.fn(),
}));

const options = {
  maintenance: [{ id: 1, title: 'QA Maintenance Request', status: 'testing', assetId: 39, Asset: { name: 'QA Maintenance Asset' } }],
  testers: [{ id: 6, fullName: 'Maintenance Coordinator' }],
};

beforeEach(() => {
  apiClient.get.mockReset();
  apiClient.get.mockResolvedValue({ data: { data: [{ id: 8, maintenanceId: 1, workOrderNumber: 'QA-WO-2026-001', statusRaw: 'completed', assetName: 'QA Maintenance Asset' }] } });
  getMaintenanceTests.mockReset();
  getMaintenanceTests.mockResolvedValue({ items: [], summary: { total: 0 } });
  getMaintenanceTestOptions.mockReset();
  getMaintenanceTestOptions.mockResolvedValue(options);
  createMaintenanceTest.mockReset();
  createMaintenanceTest.mockResolvedValue({ id: 12 });
});

test('creates a persisted technical test linked to a completed work order', async () => {
  render(<MaintTechnicalTesting />);
  expect(await screen.findByRole('heading', { name: 'Technical Testing' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'New Test' }));
  fireEvent.change(screen.getByLabelText('Maintenance Record'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Completed Work Order'), { target: { value: '8' } });
  fireEvent.change(screen.getByLabelText('Test Type'), { target: { value: 'Functional and safety' } });
  fireEvent.change(screen.getByLabelText('Test Procedure'), { target: { value: 'Run stability and safety checks' } });
  fireEvent.change(screen.getByLabelText('Expected Result'), { target: { value: 'Stable operation with no overheating' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Test' }));

  await waitFor(() => expect(createMaintenanceTest).toHaveBeenCalledWith(expect.objectContaining({
    maintenanceId: 1,
    workOrderId: 8,
    testType: 'Functional and safety',
    expectedResult: 'Stable operation with no overheating',
  })));
});