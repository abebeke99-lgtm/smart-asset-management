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
      localStorage.clear();
      apiClient.get.mockResolvedValue({
        data: {
          success: true,
          data: {
            statistics: {
              assets: { total: 13, active: 7, damaged: 1, replaced: 1, expired: 1, retired: 1, otherStatuses: [{ status: "pending-disposal", count: 2 }] },
              organization: { users: 4, colleges: 2, departments: 3 },
              workflow: { openServiceRequests: 1, pendingApprovals: 2 },
              inventory: { lowStockItems: 1, expiringChemicals: 0 },
              maintenance: { overdue: 1 },
            },
            assetByCondition: [],
            assetByCategory: [],
            thresholds: {},
          },
        },
      });
    });

    test("uses semantic status colors for dashboard KPI icons", async () => {
      render(<UIProvider><AdminDashboard /></UIProvider>);

      const activeAssets = await screen.findByRole("link", { name: "Active Assets: 7" });
      expect(activeAssets).toHaveClass("admin-dashboard-stat-card--success");
      expect(activeAssets).toHaveAttribute("href", "/admin/assets");
      expect(screen.getByRole("link", { name: "Expired Assets: 1" })).toHaveClass("admin-dashboard-stat-card--danger");
      expect(screen.getByRole("link", { name: "Retired Assets: 1" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Pending Disposal Assets: 2" })).toBeInTheDocument();
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

    test("omits maintenance overview, inventory alerts, and recent activity", async () => {
      render(<UIProvider><AdminDashboard /></UIProvider>);

      expect(await screen.findByRole("heading", { name: "Asset Overview" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Maintenance overview" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Inventory alerts" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Recent activity" })).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Asset distribution" })).toBeInTheDocument();
    });
  });
});
