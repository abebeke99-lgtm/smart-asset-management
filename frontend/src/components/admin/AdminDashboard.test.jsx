import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { normalizeDashboardThresholds } from "./AdminDashboard";
import AdminDashboard from "./AdminDashboard";
import apiClient from "../../services/apiClient";
import { UIProvider, useLanguage } from "../../contexts/UiContext";

jest.mock("../../services/apiClient", () => ({
  __esModule: true,
  default: { get: jest.fn() },
  getApiErrorMessage: jest.fn((_error, fallback) => fallback),
}));

describe("normalizeDashboardThresholds", () => {
  test("keeps dashboard settings usable when the response omits thresholds", () => {
    expect(normalizeDashboardThresholds(undefined)).toEqual({
      lowStockPercent: 10,
      expirationNoticeDays: 30,
      escalationHours: 72,
    });
  });

  test("retains configured values and replaces invalid fields safely", () => {
    expect(normalizeDashboardThresholds({
      lowStockPercent: 15,
      expirationNoticeDays: 0,
      escalationHours: "48",
    })).toEqual({
      lowStockPercent: 15,
      expirationNoticeDays: 30,
      escalationHours: 48,
    });
  });

  describe("administrator dashboard identity", () => {
    beforeEach(() => {
      apiClient.get.mockResolvedValue({
        data: {
          success: true,
          data: {
            statistics: {
              assets: { total: 10, active: 7, damaged: 1, replaced: 1, expired: 1 },
              organization: { users: 4, colleges: 2, departments: 3 },
              workflow: { openServiceRequests: 1, pendingApprovals: 2 },
              inventory: { lowStockItems: 1, expiringChemicals: 0 },
              maintenance: { overdue: 1 },
            },
            assetByCondition: [],
            assetByCategory: [],
            maintenanceOverview: [],
            inventoryAlerts: [],
            recentActivity: [],
            thresholds: {},
          },
        },
      });
    });

    test("uses semantic status colors for dashboard KPI icons", async () => {
      render(<UIProvider><AdminDashboard /></UIProvider>);

      const activeAssets = await screen.findByRole("link", { name: "Active Assets: 7" });
      expect(activeAssets).toHaveClass("admin-dashboard-stat-card--success");
      expect(screen.getByRole("link", { name: "Expired Assets: 1" })).toHaveClass("admin-dashboard-stat-card--danger");
    });

    test("updates dashboard copy without repeating its API request when language changes", async () => {
      function LanguageToggle() {
        const { setLanguage } = useLanguage();
        return <button type="button" onClick={() => setLanguage("am")}>Amharic</button>;
      }

      render(<UIProvider><AdminDashboard /><LanguageToggle /></UIProvider>);
      await screen.findByRole("link", { name: "Active Assets: 7" });
      expect(apiClient.get).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("button", { name: "Amharic" }));

      expect(await screen.findByRole("link", { name: "ንቁ ንብረቶች: 7" })).toBeInTheDocument();
      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });
  });
});
