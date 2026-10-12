import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UiProvider } from "../../contexts/UiContext";
import FinanceAudit from "./FinanceAudit";

jest.mock("axios", () => {
  const instance = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };

  global.__axiosInstance = instance;

  return {
    __esModule: true,
    default: {
      create: jest.fn(() => instance),
      isCancel: jest.fn(() => false),
      defaults: { headers: { common: {} } },
    },
  };
});

const renderPage = () =>
  render(
    <UiProvider>
      <MemoryRouter>
        <FinanceAudit />
      </MemoryRouter>
    </UiProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();

  global.__axiosInstance.get.mockResolvedValue({
    data: {
      success: true,
      total: 1,
      logs: [
        {
          id: 7,
          userId: 3,
          action: "VALUATION_CHANGE",
          entity: "asset",
          details: JSON.stringify({
            old_value: 1000,
            new_value: 1500,
            status: "Success",
            asset_tag: "AST-001",
            asset_name: "Laptop",
          }),
          createdAt: "2026-10-07T10:00:00.000Z",
          user: {
            username: "hana",
            fullName: "Hana T",
            role: "finance",
          },
        },
      ],
    },
  });
});

test("maps the nested user and JSON details from the finance audit endpoint", async () => {
  renderPage();

  expect((await screen.findAllByText("hana")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("finance").length).toBeGreaterThan(0);
  expect(screen.getAllByText("asset").length).toBeGreaterThan(0);
  expect(screen.getAllByText("AST-001").length).toBeGreaterThan(0);
  expect(screen.getByText("1,000.00")).toBeInTheDocument();
  expect(screen.getByText("1,500.00")).toBeInTheDocument();
  expect(global.__axiosInstance.get).toHaveBeenCalledWith(
    "/finance/audit",
    expect.objectContaining({
      params: expect.objectContaining({ page: 1, limit: 50 }),
    })
  );
});

test("renders the empty state when the backend returns no audit records", async () => {
  global.__axiosInstance.get.mockResolvedValueOnce({
    data: { success: true, total: 0, logs: [] },
  });

  renderPage();

  expect(
    await screen.findByText("No audit records were returned by the backend.")
  ).toBeInTheDocument();
});

test("shows a retry action after a request failure and recovers on retry", async () => {
  global.__axiosInstance.get
    .mockRejectedValueOnce(new Error("Backend unavailable"))
    .mockResolvedValueOnce({
      data: {
        success: true,
        total: 0,
        logs: [],
      },
    });

  renderPage();

  const retryButton = await screen.findByRole("button", { name: "Retry" });
  expect(retryButton.closest('[role="alert"]')).toHaveTextContent("Failed to load audit logs");
  fireEvent.click(retryButton);

  await waitFor(() => {
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  expect(
    await screen.findByText("No audit records were returned by the backend.")
  ).toBeInTheDocument();
});

test("treats a 304 response as unchanged data", async () => {
  global.__axiosInstance.get
    .mockResolvedValueOnce({
      data: {
        success: true,
        total: 1,
        logs: [{ id: 7, action: "VALUATION_CHANGE", user: { username: "hana" } }],
      },
    })
    .mockResolvedValueOnce({ status: 304, data: null });

  renderPage();
  expect(await screen.findAllByText("hana")).not.toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));

  await waitFor(() => {
    expect(global.__axiosInstance.get).toHaveBeenCalledTimes(2);
  });
  expect(screen.getAllByText("hana")).not.toHaveLength(0);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("shows a localized error instead of treating an unexpected response as empty", async () => {
  global.__axiosInstance.get.mockResolvedValueOnce({
    data: { success: true, entries: "not-an-array" },
  });

  renderPage();

  const retryButton = await screen.findByRole("button", { name: "Retry" });
  expect(retryButton.closest('[role="alert"]')).toHaveTextContent(
    "The audit service returned an unexpected response."
  );
  expect(
    screen.queryByText("No audit records were returned by the backend.")
  ).not.toBeInTheDocument();
});
