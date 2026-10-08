import React from "react";
import { render, screen } from "@testing-library/react";
import DeviceHealth from "./ICTDeviceHealth";

const jsonResponse = (data) => ({
  ok: true,
  status: 200,
  json: async () => data,
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("token", "test-device-health-token");
  global.fetch = jest.fn().mockResolvedValue(
    jsonResponse({ success: true, devices: [], total: 0, summary: {} })
  );
});

test("loads health data from the authenticated ICT device-health endpoint", async () => {
  render(<DeviceHealth />);

  expect(await screen.findByText("No device health records")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/ict/device-health?limit=50",
    expect.objectContaining({
      credentials: "include",
      headers: expect.objectContaining({
        Authorization: "Bearer test-device-health-token",
      }),
    })
  );
});

test("renders asset health data returned by the backend", async () => {
  global.fetch.mockResolvedValueOnce(jsonResponse({
    success: true,
    total: 1,
    summary: { total: 1, healthy: 1, warning: 0, critical: 0, unknown: 0 },
    devices: [{
      id: 31,
      assetName: "Lab Workstation",
      assetTag: "ICT-PC-31",
      category: "Desktop",
      healthStatus: "Healthy",
      lastInspection: "2026-10-07T00:00:00.000Z",
      location: "Computer Lab",
    }],
  }));

  render(<DeviceHealth />);

  expect(await screen.findByText("ICT-PC-31")).toBeInTheDocument();
  expect(screen.getByText("Lab Workstation")).toBeInTheDocument();
});
