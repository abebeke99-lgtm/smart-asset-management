import React from "react";
import { render, screen } from "@testing-library/react";
import ICTDashboard from "./ICTDashboard";

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

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = "en";
  useTranslation.mockImplementation(() => ({
    t: (key, fallback) =>
      mockLanguage === "am" ? amharicTranslations[key] || fallback : fallback,
  }));
  global.fetch = jest.fn().mockResolvedValue(jsonResponse({}));
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
