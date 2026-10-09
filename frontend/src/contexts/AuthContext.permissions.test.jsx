import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import { apiClient, isCurrentAuthRequest } from "../utils/api";

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
  isCurrentAuthRequest: jest.fn(),
}));

const AuthorizationState = () => {
  const { user, hasPermission, loading, login } = useAuth();
  return (
    <div>
      <span>{loading ? "Restoring session" : "Session restored"}</span>
      <span>{user ? `Signed in as ${user.role}` : "Signed out"}</span>
      <span>{hasPermission("users.view") ? "users.view granted" : "users.view denied"}</span>
      <button type="button" onClick={() => login("administrator", "valid-password")}>Sign in as administrator</button>
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
    expect(await screen.findByText("Session restored")).toBeInTheDocument();
    expect(screen.getByText("users.view denied")).toBeInTheDocument();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    fireEvent.focus(window);

    await waitFor(() => expect(screen.getByText("users.view granted")).toBeInTheDocument());
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem("user")).permissions).toContain("users.view");
  });

  it("preserves the Axios response when formatting API errors", async () => {
    apiClient.get.mockResolvedValue({
      data: { data: { id: 7, role: "ict_officer", permissions: ["assets.view"] } },
    });
    render(
      <AuthProvider>
        <AuthorizationState />
      </AuthProvider>,
    );
    expect(await screen.findByText("Session restored")).toBeInTheDocument();

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

  it("does not clear the active session for a late 401 from an older token", async () => {
    apiClient.get.mockResolvedValue({
      data: { data: { id: 7, role: "ict_officer", permissions: ["assets.view"] } },
    });
    render(
      <AuthProvider>
        <AuthorizationState />
      </AuthProvider>,
    );
    expect(await screen.findByText("Session restored")).toBeInTheDocument();

    const previousToken = localStorage.getItem("token");
    localStorage.setItem("token", "new-current-token");
    const staleRequestError = {
      response: { status: 401, data: { message: "Session expired" } },
      config: { headers: { Authorization: `Bearer ${previousToken}` } },
      message: "Request failed",
    };
    const rejectResponse = apiClient.interceptors.response.use.mock.calls[0][1];

    isCurrentAuthRequest.mockReturnValue(false);
    expect(() => rejectResponse(staleRequestError)).toThrow("Server error occurred (401)");
    expect(localStorage.getItem("token")).toBe("new-current-token");
    expect(localStorage.getItem("user")).not.toBeNull();
  });

  it("does not clear a newer login when an older session-restore request fails", async () => {
    let rejectRestoreRequest;
    apiClient.get.mockReturnValue(new Promise((_resolve, reject) => {
      rejectRestoreRequest = reject;
    }));
    const newToken = `new-header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
    apiClient.post.mockResolvedValue({
      data: {
        success: true,
        token: newToken,
        user: { id: 8, role: "admin", permissions: ["users.view"] },
      },
    });

    render(
      <AuthProvider>
        <AuthorizationState />
      </AuthProvider>,
    );
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith("/api/users/profile"));

    fireEvent.click(screen.getByRole("button", { name: "Sign in as administrator" }));
    expect(await screen.findByText("Signed in as admin")).toBeInTheDocument();

    rejectRestoreRequest(new Error("Stale session restore failed"));

    await waitFor(() => expect(localStorage.getItem("token")).toBe(newToken));
    expect(localStorage.getItem("user")).toContain('"role":"admin"');
    expect(screen.getByText("Signed in as admin")).toBeInTheDocument();
  });

  it("does not replace a newer login when an older session-restore request succeeds", async () => {
    let resolveRestoreRequest;
    apiClient.get.mockReturnValue(new Promise((resolve) => {
      resolveRestoreRequest = resolve;
    }));
    const newToken = `new-header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
    apiClient.post.mockResolvedValue({
      data: {
        success: true,
        token: newToken,
        user: { id: 8, role: "admin", permissions: ["users.view"] },
      },
    });

    render(
      <AuthProvider>
        <AuthorizationState />
      </AuthProvider>,
    );
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith("/api/users/profile"));

    fireEvent.click(screen.getByRole("button", { name: "Sign in as administrator" }));
    expect(await screen.findByText("Signed in as admin")).toBeInTheDocument();

    resolveRestoreRequest({
      data: { data: { id: 7, role: "ict_officer", permissions: ["assets.view"] } },
    });

    await waitFor(() => expect(localStorage.getItem("token")).toBe(newToken));
    expect(localStorage.getItem("user")).toContain('"role":"admin"');
    expect(screen.getByText("Signed in as admin")).toBeInTheDocument();
  });

  it("clears the session when the current token receives a 401", async () => {
    const navigationLog = jest.spyOn(console, "error").mockImplementation(() => {});
    apiClient.get.mockResolvedValue({
      data: { data: { id: 7, role: "ict_officer", permissions: ["assets.view"] } },
    });
    render(
      <AuthProvider>
        <AuthorizationState />
      </AuthProvider>,
    );
    expect(await screen.findByText("Session restored")).toBeInTheDocument();

    const currentToken = localStorage.getItem("token");
    const unauthorizedError = {
      response: { status: 401, data: { message: "Session expired" } },
      config: { headers: { Authorization: `Bearer ${currentToken}` } },
      message: "Request failed",
    };
    const rejectResponse = apiClient.interceptors.response.use.mock.calls[0][1];

    isCurrentAuthRequest.mockReturnValue(true);
    expect(() => rejectResponse(unauthorizedError)).toThrow("Server error occurred (401)");
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    navigationLog.mockRestore();
  });
});
