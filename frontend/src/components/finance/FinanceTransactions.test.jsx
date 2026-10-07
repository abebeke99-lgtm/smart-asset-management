import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import api from "../../services/api";
import FinanceTransactions from "./FinanceTransactions";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const renderPage = () => render(
  <MemoryRouter>
    <FinanceTransactions />
  </MemoryRouter>,
);

const response = (data = [], summary = {}, pagination = {}) => ({
  data: {
    success: true,
    data,
    summary: {
      postedCount: 0,
      pendingCount: 0,
      totalDebits: 0,
      totalCredits: 0,
      ...summary,
    },
    pagination: {
      page: 1,
      pageSize: 10,
      total: data.length,
      totalPages: 1,
      ...pagination,
    },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
});

test("shows loading, then persisted transactions and aggregate totals", async () => {
  let resolveRequest;
  api.get.mockReturnValueOnce(new Promise((resolve) => { resolveRequest = resolve; }));
  renderPage();

  expect(screen.getByText(/Loading transactions from the backend/)).toBeInTheDocument();
  resolveRequest(response([{
    id: 4,
    transactionNumber: "TXN-2026-0004",
    transactionDate: "2026-10-07",
    transactionType: "Receipt",
    type: "credit",
    amount: 250,
    debit: 0,
    credit: 250,
    status: "Posted",
  }], {
    postedCount: 1,
    pendingCount: 2,
    totalDebits: 75,
    totalCredits: 250,
  }, { total: 3 }));

  expect(await screen.findByText("TXN-2026-0004")).toBeInTheDocument();
  expect(within(screen.getByText("Posted", { selector: ".stat-label" }).closest(".stat-card")).getByText("1")).toBeInTheDocument();
  expect(within(screen.getByText("Pending", { selector: ".stat-label" }).closest(".stat-card")).getByText("2")).toBeInTheDocument();
  expect(within(screen.getByText("Debits", { selector: ".stat-label" }).closest(".stat-card")).getByText(/75\.00/)).toBeInTheDocument();
  expect(within(screen.getByText("Credits", { selector: ".stat-label" }).closest(".stat-card")).getByText(/250\.00/)).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith("/finance/transactions", {
    params: { page: 1, pageSize: 10 },
  });
});

test("shows the empty state when the persisted query returns no records", async () => {
  api.get.mockResolvedValue(response());
  renderPage();

  expect(await screen.findByText("No transactions found")).toBeInTheDocument();
  expect(screen.getByText("0 records")).toBeInTheDocument();
});

test("passes status filters to the backend and surfaces API errors", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  api.get.mockResolvedValueOnce(response());
  try {
    renderPage();
    await screen.findByText("No transactions found");
    api.get.mockRejectedValueOnce({
      message: "Request failed",
      response: { data: { message: "Transactions service unavailable" } },
    });
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "posted" } });

    expect(await screen.findByText("Transactions service unavailable")).toBeInTheDocument();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/finance/transactions", {
        params: { page: 1, pageSize: 10, status: "posted" },
      });
    });
    expect(consoleError).toHaveBeenCalledWith("Failed to load transactions:", expect.anything());
  } finally {
    consoleError.mockRestore();
  }
});
