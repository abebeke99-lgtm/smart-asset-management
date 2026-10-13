import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import api from "../../services/api";
import InfrastructureInventory from "./InfrastructureInventory";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

describe("InfrastructureInventory", () => {
  beforeEach(() => {
    api.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          assets: [{
            id: 22,
            name: "Generator",
            assetCode: "INFRA-22",
            serialNumber: "GEN-22",
            category: "Generator",
            type: "Fixed Asset",
            status: "Operational",
            condition: "Good",
            location: "East Wing",
            assignedTo: 55,
            assignedToName: "Alem Bekele",
            purchaseDate: "2026-01-02T00:00:00.000Z",
            manufacturer: "Acme",
            model: "G-100",
          }],
          summary: {
            total: 4,
            available: 1,
            assigned: 1,
            maintenance: 1,
            missing: 1,
            damaged: 0,
            disposed: 0,
          },
          filters: {
            categories: ["Generator"],
            locations: ["East Wing"],
            statuses: ["Operational"],
          },
        },
        pagination: { page: 1, limit: 10, total: 1, pages: 1 },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("maps asset fields to the correct columns and opens the existing registration flow", async () => {
    render(
      <MemoryRouter>
        <InfrastructureInventory />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("INFRA-22")).toBeTruthy());

    const row = screen.getByRole("row", { name: /Generator/ });
    const cells = within(row).getAllByRole("cell");
    expect(cells[0].textContent).toContain("Generator");
    expect(cells[1].textContent).toContain("INFRA-22");
    expect(cells[1].textContent).toContain("GEN-22");
    expect(cells[2].textContent).toContain("Generator");
    expect(cells[2].textContent).toContain("Fixed Asset");
    expect(cells[3].textContent).toContain("Operational");
    expect(cells[4].textContent).toContain("East Wing");
    expect(cells[5].textContent).toContain("Alem Bekele");

    expect(screen.getByRole("link", { name: /New Inventory/ }).getAttribute("href"))
      .toBe("/infrastructure/assets/register");
  });

  it("shows inventory details using the selected asset record", async () => {
    render(
      <MemoryRouter>
        <InfrastructureInventory />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("INFRA-22")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "View asset details" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Alem Bekele")).toBeTruthy();
    expect(within(dialog).getByText("Acme")).toBeTruthy();
    expect(within(dialog).getByText("G-100")).toBeTruthy();
  });

  it("updates an asset through the existing infrastructure API and refreshes the inventory", async () => {
    api.put.mockResolvedValue({
      data: {
        success: true,
        message: "Infrastructure asset updated successfully",
        data: { id: 22, name: "Generator 2", category: "Generator" },
      },
    });

    render(
      <MemoryRouter>
        <InfrastructureInventory />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("INFRA-22")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Edit Generator" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Asset Name/ }), {
      target: { value: "Generator 2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/ }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      "/api/infrastructure/22",
      expect.objectContaining({ name: "Generator 2", category: "Generator" })
    ));
    expect(api.get).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByRole("status").textContent)
      .toContain("Infrastructure asset updated successfully"));
  });

  it("requires confirmation before deleting an asset and refreshes after deletion", async () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
    api.delete.mockResolvedValue({
      data: { success: true, message: "Infrastructure asset deleted successfully" },
    });

    render(
      <MemoryRouter>
        <InfrastructureInventory />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("INFRA-22")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Delete Generator" }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/api/infrastructure/22"));
    expect(confirm).toHaveBeenCalledWith('Delete "Generator"? This action cannot be undone.');
    expect(api.get).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByRole("status").textContent)
      .toContain("Infrastructure asset deleted successfully"));
  });
});
