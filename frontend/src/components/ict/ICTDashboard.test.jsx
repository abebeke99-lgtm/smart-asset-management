import React from "react";
import { render, screen } from "@testing-library/react";
import ICTDashboard, { normalizeIctDashboard } from "./ICTDashboard";

jest.mock("../../contexts/UiContext", () => ({
  useTranslation: jest.fn(),
}));

import { useTranslation } from "../../contexts/UiContext";

let mockLanguage = "en";

const amharicTranslations = {
  "dashboard.ictHome.pageTitle": "የICT ዳሽቦርድ",
  "dashboard.ictHome.sections.assetStatus": "የንብረት ሁኔታ",
  "dashboard.ictHome.status.available": "ዝግጁ",
};

const jsonResponse = (data) => ({
  ok: true,
  status: 200,
  json: async () => data,
});

const serverDashboard = {
  success: true,
  dashboard: {
    summary: { totalAssets: 7, availableAssets: 2, assignedAssets: 3, maintenanceAssets: 1, retiredAssets: 1, supportTickets: 4 },
    kpis: {
      totalAssets: 7,
      activeAssets: 5,
      damagedAssets: 1,
      underMaintenance: 1,
      availableAssets: 2,
      assignedAssets: 3,
      openSupportTickets: 4,
      criticalIncidents: 2,
    },
    assetStatusSummary: { available: 2, assigned: 3, under_maintenance: 1, retired: 1 },
    conditionSummary: { functional: 5, damaged: 1, missing: 1, expired: 0, replaced: 0 },
    categories: [{ label: "Computing", count: 7 }],
    maintenanceSummary: { scheduled: 2, in_progress: 1, completed: 3, overdue: 1 },
    supportTickets: { submitted: 1, assigned: 1, scheduled: 0, in_progress: 1, waiting: 0, completed: 0, escalated: 1 },
    notifications: [],
    criticalIncidents: [],
    inventoryAlerts: [],
    recentActivity: [],
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = "en";
  useTranslation.mockImplementation(() => ({
    t: (key, fallback) =>
      mockLanguage === "am" ? amharicTranslations[key] || fallback : fallback,
  }));
  global.fetch = jest.fn().mockResolvedValue(jsonResponse(serverDashboard));
});

test("unwraps the authorized backend dashboard payload and displays its real KPI values", async () => {
  expect(normalizeIctDashboard(serverDashboard).kpis.totalAssets).toBe(7);
  render(<ICTDashboard />);

  expect(await screen.findByRole("heading", { level: 1, name: "ICT Dashboard" })).toBeInTheDocument();
  expect(screen.getByText("Total ICT Assets").closest(".kpi-card")).toHaveTextContent("7");
  expect(screen.getByText("Open Support Tickets").closest(".kpi-card")).toHaveTextContent("4");
});

test("switches translated dashboard labels without refetching dashboard data", async () => {
  const { rerender } = render(<ICTDashboard />);

  expect(
    await screen.findByRole("heading", { level: 1, name: "ICT Dashboard" })
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Asset Status" })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);

  mockLanguage = "am";
  rerender(<ICTDashboard />);

  expect(
    screen.getByRole("heading", { level: 1, name: "የICT ዳሽቦርድ" })
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "የንብረት ሁኔታ" })).toBeInTheDocument();
  expect(screen.getByText("ዝግጁ")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("does not show zero KPI values when the dashboard API fails", async () => {
  global.fetch.mockRejectedValue(new Error("database offline"));
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  render(<ICTDashboard />);

  expect(await screen.findByRole("alert")).toHaveTextContent("database offline");
  expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
  expect(screen.queryByText("Total ICT Assets")).not.toBeInTheDocument();
  expect(errorLog).toHaveBeenCalledWith("ICT dashboard error:", expect.any(Error));
});
