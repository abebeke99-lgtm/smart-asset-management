import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import { apiClient } from "../utils/api";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    defaults: { headers: { common: {} } },
    interceptors: { response: { use: jest.fn() } },
  },
}));

jest.mock("../utils/api", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    interceptors: { response: { use: jest.fn(() => 1), eject: jest.fn() } },
  },
  getApiErrorMessage: jest.fn((_error, fallback) => fallback),
}));

const AuthorizationState = () => {
  const { user, hasPermission } = useAuth();
  return (
    <div>
      <span>{user ? `Signed in as ${user.role}` : "Signed out"}</span>
      <span>{hasPermission("users.view") ? "users.view granted" : "users.view denied"}</span>
    </div>
  );
};

describe("AuthContext permission refresh", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    const tokenPayload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem("token", `header.${tokenPayload}.signature`);
    localStorage.setItem("user", JSON.stringify({ id: 7, role: "ict_officer", permissions: ["assets.view"] }));
  });

  it("refreshes the authenticated user's permissions when the app regains focus", async () => {
    apiClient.get
      .mockResolvedValueOnce({
        data: { data: { id: 7, role: "ict_officer", permissions: ["assets.view"] } },
      })
      .mockResolvedValueOnce({
        data: { data: { id: 7, role: "ict_officer", permissions: ["assets.view", "users.view"] } },
      });

    render(
      <AuthProvider>
        <AuthorizationState />
      </AuthProvider>,
    );

    expect(await screen.findByText("Signed in as ict_officer")).toBeInTheDocument();
    expect(screen.getByText("users.view denied")).toBeInTheDocument();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    fireEvent.focus(window);

    await waitFor(() => expect(screen.getByText("users.view granted")).toBeInTheDocument());
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem("user")).permissions).toContain("users.view");
  });
});
