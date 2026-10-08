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

const permissionRows = [
  { id: 10, key: "roles_permissions.view", action: "view" },
  { id: 11, key: "roles_permissions.create", action: "create" },
  { id: 12, key: "roles_permissions.edit", action: "edit" },
  { id: 13, key: "roles_permissions.delete", action: "delete" },
  { id: 14, key: "roles_permissions.approve", action: "approve" },
  { id: 15, key: "roles_permissions.assign", action: "assign" },
  { id: 16, key: "roles_permissions.transfer", action: "transfer" },
  { id: 17, key: "roles_permissions.maintain", action: "maintain" },
  { id: 18, key: "roles_permissions.report", action: "report" },
  { id: 19, key: "roles_permissions.configure", action: "configure" },
];
const roleRows = [
  {
    id: 1,
    name: "admin",
    label: "Administrator",
    description: "System administration",
    isSystem: true,
    active: true,
    userCount: 1,
    permissions: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((id) => ({
      id,
      key: `roles_permissions.${permissionRows.find((permission) => permission.id === id)?.action || "view"}`,
      action: permissionRows.find((permission) => permission.id === id)?.action || "view",
      scopeType: "system",
      limited: false,
    })),
  },
  {
    id: 2,
    name: "ict_officer",
    label: "ICT Officer",
    description: "ICT operations",
    isSystem: true,
    active: true,
    userCount: 2,
    permissions: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((id) => ({
      id,
      key: `roles_permissions.${permissionRows.find((permission) => permission.id === id)?.action || "view"}`,
      action: permissionRows.find((permission) => permission.id === id)?.action || "view",
      scopeType: [13, 19].includes(id) ? "college" : "system",
      limited: [13, 19].includes(id),
    })),
  },
];
const userRows = [
  { id: 7, fullName: "Test Administrator", username: "admin", roles: [{ id: 1, name: "Administrator", scopeType: "system" }] },
];

const setupApi = () => {
  apiClient.get.mockImplementation((url) => {
    if (url === "/api/admin/roles-permissions/roles") return Promise.resolve({ data: { success: true, data: roleRows } });
    if (url === "/api/admin/roles-permissions/permissions") return Promise.resolve({ data: { success: true, data: permissionRows } });
    if (url === "/api/admin/roles-permissions/users") return Promise.resolve({ data: { success: true, data: userRows } });
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
};

describe("Admin Roles & Permissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupApi();
  });

  it("loads the role-by-action matrix and scope controls", async () => {
    render(<AdminRolesPermissions />);

    expect(await screen.findByRole("heading", { name: "Permission matrix" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Configure" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Administrator view permission" })).toHaveValue("full");
    expect(screen.getByRole("combobox", { name: "ICT Officer delete permission" })).toHaveValue("limited");
    expect(screen.getByRole("combobox", { name: "ICT Officer delete scope" })).toHaveValue("college");
    expect(screen.getByText(/Limited is restricted to the selected organizational scope/)).toBeInTheDocument();
  });

  it("confirms high-risk changes with the affected user count before saving", async () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    apiClient.put.mockResolvedValue({ data: { success: true, data: roleRows } });
    render(<AdminRolesPermissions />);

    fireEvent.change(await screen.findByRole("combobox", { name: "ICT Officer delete permission" }), { target: { value: "full" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith(
      "/api/admin/roles-permissions/matrix",
      expect.objectContaining({ roles: expect.arrayContaining([expect.objectContaining({ roleId: 2 })]) }),
    ));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("ICT Officer: delete (2 assigned users)"));
    confirmSpy.mockRestore();
  });

  it("assigns scoped roles to a selected user after confirmation", async () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    apiClient.put.mockResolvedValue({ data: { success: true } });
    render(<AdminRolesPermissions />);

    const roleSelect = await screen.findByRole("combobox", { name: "Role" });
    fireEvent.change(roleSelect, { target: { value: "2" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Scope" }), { target: { value: "department" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Scope ID" }), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Add role" }));
    fireEvent.click(screen.getByRole("button", { name: "Save user assignments" }));

    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith(
      "/api/admin/roles-permissions/users/7/roles",
      { assignments: [{ roleId: 1, scopeType: "system", scopeId: null }, { roleId: 2, scopeType: "department", scopeId: 12 }] },
    ));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Test Administrator"));
    confirmSpy.mockRestore();
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
