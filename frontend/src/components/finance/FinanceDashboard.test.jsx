import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import api from "../../services/api";
import FinanceDashboard from "./FinanceDashboard";
import { UiProvider, useLanguage } from "../../contexts/UiContext";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

jest.mock("../../i18n/messages", () => ({
  translateMessage: (language, key, fallback) => {
    const translations = {
      en: {
        "dashboard.financeHome.welcome": "Finance home (English)",
        "dashboard.financeHome.filters.title": "Dashboard filters (English)",
      },
      am: {
        "dashboard.financeHome.welcome": "የፋይናንስ መነሻ",
        "dashboard.financeHome.filters.title": "የዳሽቦርድ ማጣሪያዎች",
      },
    };

    return translations[language]?.[key] || fallback;
  },
}));

function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <button
      type="button"
      onClick={() => setLanguage(language === "en" ? "am" : "en")}
    >
      Switch language
    </button>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("language", "en");
  api.get.mockImplementation((url) => Promise.resolve({
    data: url.endsWith("/filters")
      ? { data: { departments: [], categories: [], statuses: [], financialYears: [] } }
      : { data: { summary: {}, byDepartment: [], byCategory: [], byStatus: [], valueTrend: [] } },
  }));
});

test("switches dashboard copy between English and Amharic without reloading dashboard APIs", async () => {
  render(
    <UiProvider>
      <MemoryRouter>
        <LanguageToggle />
        <FinanceDashboard />
      </MemoryRouter>
    </UiProvider>
  );

  expect(await screen.findByText("Finance home (English)")).toBeInTheDocument();
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));

  fireEvent.click(screen.getByRole("button", { name: "Switch language" }));

  expect(await screen.findByText("የፋይናንስ መነሻ")).toBeInTheDocument();
  expect(screen.getByText("የዳሽቦርድ ማጣሪያዎች")).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(2);

  fireEvent.click(screen.getByRole("button", { name: "Switch language" }));

  expect(await screen.findByText("Finance home (English)")).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(2);
});
