import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import api from "../../services/api";
import FinancePayments from "./FinancePayments";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("invalid or missing payment summary values render as zero without React NaN warnings", async () => {
  api.get.mockImplementation((url) => Promise.resolve({
    data: url.endsWith("/payments")
      ? {
        success: true,
        data: [{ id: 1, paymentNumber: "PAY-1", amount: "not-a-number" }],
        summary: {
          total: "not-a-number",
          approved: undefined,
          processing: null,
          totalAmount: "invalid",
        },
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      }
      : { success: true, data: [] },
  }));
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

  try {
    render(<FinancePayments />);

    expect(await screen.findByText("PAY-1")).toBeInTheDocument();
    expect(screen.getByText("Total Payments").parentElement.parentElement).toHaveTextContent("0");
    expect(screen.getByText("Pending").parentElement.parentElement).toHaveTextContent("0");
    expect(screen.getByText("Total Amount").parentElement.parentElement).toHaveTextContent(/0\.00/);
    await waitFor(() => {
      expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/Received NaN/);
    });
  } finally {
    consoleError.mockRestore();
  }
});
