import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TechnicalSupport from "./ICTTechnicalSupport";

const jsonResponse = (data) => ({
  ok: true,
  status: 200,
  json: async () => data,
});

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue(
    jsonResponse({ success: true, data: [] })
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("loads tickets from the supported technical support API endpoint", async () => {
  render(<TechnicalSupport />);

  expect(await screen.findByText("No support tickets found")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/technical-support/tickets?limit=100",
    expect.objectContaining({ headers: expect.any(Object) })
  );
});

test("creates a ticket using the supported API fields and category values", async () => {
  global.fetch
    .mockResolvedValueOnce(jsonResponse({ success: true, data: [] }))
    .mockResolvedValueOnce(jsonResponse({
      success: true,
      data: {
        id: 27,
        requestCode: "TS-2025-000027",
        title: "Account access",
        description: "Unable to sign in",
        category: "account / access",
        priority: "high",
        status: "open",
      },
    }));

  render(<TechnicalSupport />);
  await screen.findByText("No support tickets found");
  fireEvent.click(screen.getAllByRole("button", { name: "New Ticket" })[0]);
  fireEvent.change(screen.getByPlaceholderText("Briefly describe the issue"), {
    target: { value: "Account access" },
  });
  fireEvent.change(
    screen.getByPlaceholderText(/describe the technical problem/i),
    { target: { value: "Unable to sign in" } }
  );
  fireEvent.change(screen.getByLabelText("Category"), {
    target: { value: "Account Access" },
  });
  fireEvent.change(screen.getByLabelText("Priority"), {
    target: { value: "High" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create Ticket" }));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
  expect(global.fetch).toHaveBeenLastCalledWith(
    "/api/technical-support/tickets",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        subject: "Account access",
        description: "Unable to sign in",
        category: "account / access",
        priority: "high",
        dueDate: null,
      }),
    })
  );
  expect(await screen.findByText("TS-2025-000027")).toBeInTheDocument();
});
