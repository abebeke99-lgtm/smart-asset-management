import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import InfrastructureDashboard from "./InfrastructureDashboard";
import api from "../../services/api";
import { UIProvider, useLanguage } from "../../contexts/UiContext";

const mockAmharicCatalog = {
  "dashboard.infrastructureHome.title": "የመሠረተ ልማት ዳይሬክቶሬት",
  "dashboard.infrastructureHome.categoriesTitle": "የመሠረተ ልማት ምድቦች",
  "dashboard.infrastructureHome.quickActions": "ፈጣን እርምጃዎች",
  "dashboard.infrastructureHome.noAssetsFound": "ምንም የመሠረተ ልማት ንብረቶች አልተገኙም",
  "dashboard.infrastructureHome.loadErrorTitle": "የዳሽቦርድ ውሂብ መጫን አልተቻለም",
  "dashboard.infrastructureHome.loadErrorFallback": "የመሠረተ ልማት ዳይሬክቶሬት ዳሽቦርድን መጫን አልተቻለም።",
};

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock("../../i18n/messages", () => ({
  translateMessage: (language, key, fallback) => (
    language === "am" ? mockAmharicCatalog[key] || fallback : fallback
  ),
}));

function LanguageToggle() {
  const { setLanguage } = useLanguage();
  return (
    <button type="button" onClick={() => setLanguage("am")}>
      Amharic
    </button>
  );
}

beforeEach(() => {
  localStorage.clear();
  api.get.mockReset();
  api.get.mockResolvedValue({
    data: {
      data: {
        totalInfrastructureAssets: 3,
        recentAssets: [{ id: "asset-1", name: "API asset name", status: "custom-api-status" }],
      },
    },
  });
});

test("switches static dashboard copy to Amharic without refetching or translating API values", async () => {
  render(
    <MemoryRouter>
      <UIProvider>
        <InfrastructureDashboard />
        <LanguageToggle />
      </UIProvider>
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "Infrastructure Directorate" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Infrastructure Categories" })).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith("/api/infrastructure/dashboard");

  fireEvent.click(screen.getByRole("button", { name: "Amharic" }));

  expect(await screen.findByRole("heading", { name: "የመሠረተ ልማት ዳይሬክቶሬት" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "የመሠረተ ልማት ምድቦች" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "ፈጣን እርምጃዎች" })).toBeInTheDocument();
  expect(screen.getByText("API asset name")).toBeInTheDocument();
  expect(screen.getByText("Custom-Api-Status")).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);
});

test("translates the dashboard error fallback without refetching", async () => {
  api.get.mockRejectedValue({});
  render(
    <MemoryRouter>
      <UIProvider>
        <InfrastructureDashboard />
        <LanguageToggle />
      </UIProvider>
    </MemoryRouter>
  );

  expect(await screen.findByText("Unable to load Infrastructure Directorate dashboard.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Amharic" }));

  expect(await screen.findByText("የመሠረተ ልማት ዳይሬክቶሬት ዳሽቦርድን መጫን አልተቻለም።")).toBeInTheDocument();
  expect(screen.getByText("የዳሽቦርድ ውሂብ መጫን አልተቻለም")).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);
});
