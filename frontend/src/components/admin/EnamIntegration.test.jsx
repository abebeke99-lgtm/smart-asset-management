import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import EnamIntegration from "./EnamIntegration";
import apiClient from "../../services/apiClient";

jest.mock("../../services/apiClient", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

const emptyIntegrationResponse = {
  headers: { "content-type": "application/json; charset=utf-8" },
  data: {
    success: true,
    data: {
      enabled: false,
      status: "Not Configured",
      lastSync: null,
      settings: {},
      statistics: {
        totalSynced: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
      },
      logs: [],
      mappings: [],
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.get.mockResolvedValue(emptyIntegrationResponse);
});

test("loads the authenticated ENAM endpoint and displays the unconfigured empty state", async () => {
  render(<EnamIntegration />);

  expect(await screen.findByText("No synchronization record available.")).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith("/enam", {
    headers: { Accept: "application/json" },
  });
  expect(screen.getByRole("heading", { name: "ENAM Integration", level: 1 })).toBeInTheDocument();
});

test("reports an HTML response as an unavailable ENAM service instead of a JSON parsing error", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  apiClient.get.mockResolvedValue({
    headers: { "content-type": "text/html; charset=utf-8" },
    data: "<!doctype html><html></html>",
  });

  render(<EnamIntegration />);

  await waitFor(() => {
    expect(screen.getByText(/ENAM service is unavailable/)).toBeInTheDocument();
  });
  expect(screen.queryByText(/Unexpected token/)).not.toBeInTheDocument();
});
