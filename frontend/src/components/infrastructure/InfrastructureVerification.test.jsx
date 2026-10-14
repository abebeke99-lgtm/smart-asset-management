import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../../services/api";
import InfrastructureVerification from "./InfrastructureVerification";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
}));

describe("InfrastructureVerification", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.put.mockReset();
    api.get.mockResolvedValue({
      data: {
        data: [{
          id: 12,
          name: "Water Pump",
          assetCode: "INFRA-12",
          qrCode: "QR-12",
          rfidTag: "RFID-12",
          location: "East Wing",
          condition: "Good",
          latestVerification: null,
        }],
        pagination: { pages: 1 },
      },
    });
  });

  it("loads Infrastructure assets and records a verification against the Infrastructure asset ID", async () => {
    api.put.mockResolvedValue({ data: { success: true } });
    render(<InfrastructureVerification />);

    expect(await screen.findByText("Water Pump")).toBeInTheDocument();
    expect(screen.getByText("Not yet verified")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Verify/ }));
    fireEvent.change(screen.getByLabelText("Result"), { target: { value: "damaged" } });
    fireEvent.change(screen.getByLabelText("Observed location"), { target: { value: "Workshop" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Cracked casing" } });
    fireEvent.click(screen.getByRole("button", { name: "Save verification" }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      "/api/infrastructure/verification/12",
      expect.objectContaining({
        state: "damaged",
        observedLocation: "Workshop",
        notes: "Cracked casing",
      })
    ));
    expect(await screen.findByRole("status")).toHaveTextContent("Verification recorded for Water Pump.");
  });

  it("shows verification API failures rather than rendering an empty success state", async () => {
    api.get.mockRejectedValueOnce({ response: { data: { message: "Verification unavailable" } } });
    render(<InfrastructureVerification />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Verification unavailable");
  });
});
