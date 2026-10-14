import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ICTAssetHistory from "./ICTAssetHistory";
import apiClient from "../../services/apiClient";
import { getAssetHistory } from "../../services/ictAssetHistoryService";

jest.mock("../../services/apiClient", () => ({
  __esModule: true,
  default: { get: jest.fn() },
  getApiErrorMessage: jest.fn((error, fallback) => error?.message || fallback),
}));

jest.mock("../../services/ictAssetHistoryService", () => ({
  getAssetHistory: jest.fn(),
  getAssetHistoryByAsset: jest.fn(),
}));

describe("ICTAssetHistory", () => {
  it("shows the empty state when history and filter responses are not arrays", async () => {
    apiClient.get.mockResolvedValue({ data: { categories: {}, departments: {} } });
    getAssetHistory.mockResolvedValue({ data: { data: {}, eventTypes: {} } });

    render(
      <MemoryRouter>
        <ICTAssetHistory />
      </MemoryRouter>
    );

    expect(await screen.findByText("No asset history found.")).toBeInTheDocument();
  });
});
