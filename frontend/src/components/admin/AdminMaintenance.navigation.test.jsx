import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import axios from "axios";
import AdminMaintenance from "./AdminMaintenance";
import { UIProvider } from "../../contexts/UiContext";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({ data: [] }),
  },
}));

describe("Admin maintenance navigation", () => {
  beforeEach(() => {
    axios.get.mockResolvedValue({ data: [] });
  });

  it("hides the requested maintenance navigation items while retaining Requests", async () => {
    render(
      <UIProvider>
        <AdminMaintenance />
      </UIProvider>,
    );

    expect(await screen.findByRole("button", { name: /Requests/ })).toBeInTheDocument();

    [
      /Scheduled Maintenance/,
      /^Pending$/,
      /In Progress/,
      /^Completed$/,
      /^Technicians$/,
      /Maintenance History/,
    ].forEach((name) => {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    });
  });
});
