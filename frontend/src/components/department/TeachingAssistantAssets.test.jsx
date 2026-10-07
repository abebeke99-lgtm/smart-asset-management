import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import apiClient from "../../services/apiClient";
import TeachingAssistantAssets from "./TeachingAssistantAssets";

jest.mock("../../services/apiClient", () => ({
  __esModule: true,
  default: { get: jest.fn() },
  getApiErrorMessage: jest.fn((_error, fallback) => fallback),
}));

jest.mock("../admin/ui/PageHeader", () => ({
  __esModule: true,
  default: ({ title, subtitle }) => <header><h1>{title}</h1><p>{subtitle}</p></header>,
}));

describe("Teaching Assistant department assets", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads real asset rows from the department-scoped API", async () => {
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: [{
          id: 12,
          assetCode: "MAU-12",
          name: "Laptop",
          department: "Computer Science",
          status: "Available",
        }],
      },
    });

    render(<TeachingAssistantAssets />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading department assets...");
    expect(await screen.findByText("MAU-12")).toBeInTheDocument();
    expect(screen.getByText("Computer Science")).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith("/api/assets", { params: { page: 1, limit: 25 } });
    expect(screen.queryByRole("button", { name: /assign|edit|delete/i })).not.toBeInTheDocument();
  });

  it("shows an explicit error instead of an empty success state when loading fails", async () => {
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
    apiClient.get.mockRejectedValue(new Error("request failed"));

    render(<TeachingAssistantAssets />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load department assets.");
    expect(screen.queryByText("No assets are assigned to your department.")).not.toBeInTheDocument();
    expect(errorLog).toHaveBeenCalledWith("Teaching Assistant asset list request failed:", {
      status: 0,
      message: "request failed",
    });
  });
});
