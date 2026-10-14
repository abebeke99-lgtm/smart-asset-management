import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import InfrastructureTransformers from "./InfrastructureTransformers";
import api from "../../services/api";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "infrastructure" } }),
}));

describe("InfrastructureTransformers", () => {
  it("renders the empty state when the API omits filter collections", async () => {
    api.get.mockResolvedValue({
      data: {
        data: [],
        summary: {},
        filters: {},
        pagination: { total: 0, totalPages: 1, page: 1 },
      },
    });

    render(
      <MemoryRouter>
        <InfrastructureTransformers />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Transformers" })).toBeInTheDocument();
    expect(await screen.findByText("No transformers found")).toBeInTheDocument();
  });
});
