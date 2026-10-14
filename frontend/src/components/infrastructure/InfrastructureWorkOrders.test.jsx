import React from "react";
import { render, screen } from "@testing-library/react";
import InfrastructureWorkOrders from "./InfrastructureWorkOrders";
import api from "../../services/api";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

describe("InfrastructureWorkOrders", () => {
  it("shows its empty state when the API returns a non-array data payload", async () => {
    api.get.mockResolvedValue({ data: { data: {}, pagination: { page: 1, pages: 1, total: 0 } } });

    render(<InfrastructureWorkOrders />);

    expect(await screen.findByRole("heading", { name: "Infrastructure Work Orders" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "No work orders found" })).toBeInTheDocument();
  });
});
