import React from "react";
import { render, screen } from "@testing-library/react";
import ICTRFIDTracking from "./ICTRFIDTracking";
import apiClient from "../../services/apiClient";

jest.mock("../../services/apiClient", () => ({
  __esModule: true,
  default: { get: jest.fn() },
  getApiErrorMessage: jest.fn((error, fallback) => error?.message || fallback),
}));

describe("ICTRFIDTracking", () => {
  it("shows the empty state for non-array tracking data and filters", async () => {
    apiClient.get.mockResolvedValue({ data: { data: {}, filters: { categories: {}, locations: null } } });

    render(<ICTRFIDTracking />);

    expect(await screen.findByText("No tracked assets yet")).toBeInTheDocument();
  });
});
