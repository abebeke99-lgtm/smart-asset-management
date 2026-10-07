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

  it("preserves the Axios response when formatting API errors", async () => {
    render(
      <AuthProvider>
        <AuthorizationState />
      </AuthProvider>,
    );

    const response = { status: 403, data: { message: "Missing department profile permission." } };
    const apiError = { response, config: { url: "/api/department-head/profile" }, message: "Request failed" };
    const rejectResponse = apiClient.interceptors.response.use.mock.calls[0][1];

    let thrownError;
    try {
      rejectResponse(apiError);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBe(apiError);
    expect(thrownError.response).toBe(response);
    expect(thrownError.status).toBe(403);
    expect(thrownError.message).toBe("Server error occurred (403)");
  });
});
