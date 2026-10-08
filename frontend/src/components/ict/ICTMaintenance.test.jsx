import React from "react";
import { render, screen } from "@testing-library/react";
import ICTMaintenance from "./ICTMaintenance";

const jsonResponse = (data) => ({
  ok: true,
  status: 200,
  json: async () => data,
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("token", "test-maintenance-token");
  global.fetch = jest.fn().mockResolvedValue(
    jsonResponse({ success: true, data: [] })
  );
});

test("loads ICT maintenance from the authenticated maintenance API", async () => {
  render(<ICTMaintenance />);

  expect(await screen.findByText("No maintenance records found")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/maintenance?limit=100",
    expect.objectContaining({
      credentials: "include",
      headers: expect.objectContaining({
        Authorization: "Bearer test-maintenance-token",
      }),
    })
  );
});

test("displays maintenance fields returned by the backend", async () => {
  global.fetch.mockResolvedValueOnce(jsonResponse({
    success: true,
    data: [{
      id: 42,
      title: "Power repair",
      description: "Laptop will not power on",
      status: "In Progress",
      priority: "high",
      asset_tag: "ICT-LAP-42",
      asset_name: "Field Laptop",
      requested_by_name: "Requester Name",
      assigned_to_name: "Maintenance Technician",
      asset: {
        id: 8,
        name: "Field Laptop",
        assetCode: "ICT-LAP-42",
        category: "Laptop",
        location: "ICT Office",
        department: "ICT",
      },
    }],
  }));

  render(<ICTMaintenance />);

  expect(await screen.findByText("MNT-00042")).toBeInTheDocument();
  expect(screen.getByText("ICT-LAP-42")).toBeInTheDocument();
  expect(screen.getByText("Laptop will not power on")).toBeInTheDocument();
  expect(screen.getByText("Maintenance Technician")).toBeInTheDocument();
});
