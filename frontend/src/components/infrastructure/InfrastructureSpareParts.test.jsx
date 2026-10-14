import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import api from "../../services/api";
import InfrastructureSpareParts from "./InfrastructureSpareParts";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

describe("InfrastructureSpareParts", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockResolvedValue({
      data: {
        data: [{
          id: 7,
          partName: "Fuse",
          partCode: "F-7",
          category: "Electrical",
          quantity: 2,
          minimumStock: 5,
          location: "Stores",
        }],
      },
    });
  });

  it("loads spare parts and displays the low-stock state", async () => {
    render(<InfrastructureSpareParts />);

    expect(await screen.findByText("F-7")).toBeInTheDocument();
    expect(screen.getByText("Low stock")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/api/infrastructure/spare-parts", {
      params: { search: "", limit: 100 },
    });
  });

  it("loads transaction history for the selected part", async () => {
    api.get.mockImplementation((url) => {
      if (url === "/api/infrastructure/spare-parts") {
        return Promise.resolve({ data: { data: [{ id: 7, partName: "Fuse", partCode: "F-7", quantity: 10, minimumStock: 5 }] } });
      }
      return Promise.resolve({
        data: { data: [{ id: 8, transactionType: "receive", quantity: 5, previousQuantity: 5, newQuantity: 10, notes: "Restock" }] },
      });
    });
    render(<InfrastructureSpareParts />);

    fireEvent.click(await screen.findByRole("button", { name: "View history" }));
    expect(await screen.findByText("Restock")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/api/infrastructure/spare-parts/7/transactions");
  });

  it("shows API errors explicitly", async () => {
    api.get.mockRejectedValueOnce({ response: { data: { message: "Database unavailable" } } });
    render(<InfrastructureSpareParts />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Database unavailable");
  });
});
