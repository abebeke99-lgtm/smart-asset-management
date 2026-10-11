import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import apiClient from "../../services/apiClient";
import AdminRolesPermissions from "./AdminRolesPermissions";

jest.mock("../../services/apiClient", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
  getApiErrorMessage: jest.fn((_error, fallback) => fallback),
}));

const roleRows = [
  {
    id: 1,
    name: "admin",
    label: "Administrator",
    description: "System administration",
    isSystem: true,
    active: true,
    userCount: 1,
  },
  {
    id: 2,
    name: "ict_officer",
    label: "ICT Officer",
    description: "ICT operations",
    isSystem: true,
    active: true,
    userCount: 2,
  },
];
const setupApi = () => {
  apiClient.get.mockImplementation((url) => {
    if (url === "/api/admin/roles-permissions/roles") return Promise.resolve({ data: { success: true, data: roleRows } });
    if (url === "/api/admin/roles-permissions/users") return Promise.resolve({ data: { success: true, data: userRows } });
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
};

describe("Admin Roles & Permissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupApi();
  });

  it("omits permission matrix and user assignment controls", async () => {
    render(<AdminRolesPermissions />);

    expect(await screen.findByRole("heading", { name: "Roles" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Permission matrix" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "User role assignments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save user assignments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Search users" })).not.toBeInTheDocument();
    expect(apiClient.get).not.toHaveBeenCalledWith("/api/admin/roles-permissions/permissions");
    expect(apiClient.get).not.toHaveBeenCalledWith("/api/admin/roles-permissions/users");
  });

  it("creates and refreshes a custom role", async () => {
    apiClient.post.mockResolvedValue({ data: { success: true } });
    render(<AdminRolesPermissions />);

    fireEvent.change(await screen.findByRole("textbox", { name: "New role name" }), { target: { value: "Research Coordinator" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "Research equipment access" } });
    fireEvent.click(screen.getByRole("button", { name: "Create role" }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(
      "/api/admin/roles-permissions/roles",
      { name: "Research Coordinator", displayName: "Research Coordinator", description: "Research equipment access" },
    ));
  });
});
