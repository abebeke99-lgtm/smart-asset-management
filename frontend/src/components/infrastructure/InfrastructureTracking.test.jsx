import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import api from "../../services/api";
import InfrastructureTracking from "./InfrastructureTracking";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

jest.mock("../../contexts/AuthContext", () => {
  const user = { id: 12, role: "infrastructure" };
  return { useAuth: () => ({ user, loading: false }) };
});

const taggedAssetResponse = {
  data: {
    data: [{
      id: 4,
      assetNumber: "INFRA-4",
      name: "Generator",
      qrCode: "QR-4",
      rfidTag: "RFID-4",
      location: "East Wing",
      status: "Operational",
      condition: "Good",
    }],
    summary: { total: 1, active: 1, qr: 1, rfid: 1 },
    pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
  },
};

describe("InfrastructureTracking", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
    api.delete.mockReset();
    api.get.mockResolvedValue(taggedAssetResponse);
  });

  it("lists persisted tagged assets and records scans through the supported endpoint", async () => {
    api.post.mockResolvedValue({
      data: {
        data: {
          name: "Generator",
          assetNumber: "INFRA-4",
          location: "East Wing",
          workflowNote: "Maintenance is not linked.",
          history: [],
        },
      },
    });
    render(<MemoryRouter><InfrastructureTracking /></MemoryRouter>);

    expect(await screen.findByText("Generator")).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      "/api/infrastructure/tracking",
      expect.any(Object)
    ));
    fireEvent.change(screen.getByRole("textbox", { name: "RFID or QR identifier" }), {
      target: { value: "RFID-4" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Observed scan location" }), {
      target: { value: "Workshop" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan tag" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      "/api/infrastructure/tracking/scan",
      { identifier: "RFID-4", scanType: "rfid", observedLocation: "Workshop" }
    ));
    expect(await screen.findByText("Maintenance is not linked.")).toBeInTheDocument();
  });

  it("registers an identifier on an existing Infrastructure asset", async () => {
    api.post.mockResolvedValue({
      data: { success: true, message: "Infrastructure asset tag registered successfully." },
    });
    render(<MemoryRouter><InfrastructureTracking /></MemoryRouter>);

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Register Tag" }));
    fireEvent.change(screen.getByPlaceholderText("Existing asset ID"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByPlaceholderText("Unique QR or tag code"), {
      target: { value: "QR-NEW" },
    });

    expect(screen.getByRole("heading", { name: "Register RFID / QR Tag" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Register Tag" }).slice(-1)[0]);

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      "/api/infrastructure/tracking",
      expect.objectContaining({
        assetId: "4",
        tagType: "QR",
        tagCode: "QR-NEW",
      })
    ));
  });
});
