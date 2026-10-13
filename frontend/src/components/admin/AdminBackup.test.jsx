import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Backup from "./AdminBackup";
import apiClient from "../../services/apiClient";

jest.mock("../../services/apiClient", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.get.mockResolvedValue({
    data: { success: true, data: [], backups: [] },
  });
});

test("loads backups through the shared authenticated API client", async () => {
  render(<Backup />);

  expect(await screen.findByText("No backups yet")).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith("/admin/backups", {
    headers: { Accept: "application/json" },
  });
});

test("shows a JSON backup API error instead of parsing response text as a successful payload", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  apiClient.get.mockRejectedValue({
    response: {
      status: 500,
      data: { success: false, message: "Internal server error" },
    },
    message: "Request failed with status code 500",
  });

  render(<Backup />);

  expect(await screen.findByText("Internal server error")).toBeInTheDocument();
});

test("submits backup creation through the shared authenticated API client", async () => {
  apiClient.post.mockResolvedValue({ data: { success: true } });
  render(<Backup />);

  fireEvent.click(await screen.findByRole("button", { name: "Create Backup" }));

  await waitFor(() => {
    expect(apiClient.post).toHaveBeenCalledWith(
      "/admin/backups",
      expect.objectContaining({ type: "Full", backupType: "Full" }),
      { headers: { Accept: "application/json" } },
    );
  });
});
