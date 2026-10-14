import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../../services/api";
import InfrastructureAudit from "./InfrastructureAudit";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

describe("InfrastructureAudit", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockResolvedValue({
      data: {
        data: [{
          id: 9,
          action: "UPDATE_INFRASTRUCTURE_ASSET",
          entity: "infrastructure_asset:9",
          details: "{\"source\":\"test\"}",
          createdAt: "2026-02-01T00:00:00.000Z",
          User: { fullName: "Infrastructure Operator" },
        }],
        pagination: { pages: 1 },
      },
    });
  });

  it("loads infrastructure audit events from the scoped read API", async () => {
    render(<InfrastructureAudit />);

    expect(await screen.findByText("UPDATE_INFRASTRUCTURE_ASSET")).toBeInTheDocument();
    expect(screen.getByText("Infrastructure Operator")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/api/infrastructure/audit", {
      params: { page: 1, limit: 20, search: "" },
    });
  });

  it("shows the API error rather than substituting sample audit data", async () => {
    api.get.mockRejectedValueOnce({ response: { data: { message: "Access denied" } } });
    render(<InfrastructureAudit />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
    expect(screen.queryByText("UPDATE_INFRASTRUCTURE_ASSET")).not.toBeInTheDocument();
  });

  it("uses the search query when filtering audit events", async () => {
    render(<InfrastructureAudit />);
    await screen.findByText("UPDATE_INFRASTRUCTURE_ASSET");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search audit records" }), {
      target: { value: "asset" },
    });

    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/api/infrastructure/audit", {
      params: { page: 1, limit: 20, search: "asset" },
    }));
  });
});
