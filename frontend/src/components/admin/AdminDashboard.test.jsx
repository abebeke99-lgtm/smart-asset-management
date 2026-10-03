import { normalizeDashboardThresholds } from "./AdminDashboard";

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
});
