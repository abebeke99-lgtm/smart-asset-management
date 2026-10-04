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
  },
  getApiErrorMessage: jest.fn((_error, fallback) => fallback),
}));

const roles = [
  {
    id: "admin",
    label: "Administrator",
    description: "System administrator",
    permissions: ["assets.view", "roles.view"],
    permissionCount: 2,
  },
  {
    id: "ict_officer",
    label: "ICT Officer",
    description: "ICT operations",
    permissions: ["assets.view"],
    permissionCount: 1,
  },
];

const permissions = [
  { name: "assets.view" },
  { name: "assets.create" },
  { name: "roles.view" },
];

const setApiResponses = () => {
  apiClient.get.mockImplementation((url) => {
    if (url === "/api/admin/roles") {
      return Promise.resolve({ data: { success: true, data: roles } });
    }
    if (url === "/api/admin/permissions") {
      return Promise.resolve({ data: { success: true, data: permissions } });
    }
    const role = decodeURIComponent(url.split("/")[4]);
    return Promise.resolve({
      data: {
        success: true,
        data: {
          role,
          permissions: role === "admin" ? ["assets.view", "roles.view"] : ["assets.view"],
        },
      },
    });
  });
};

describe("Admin Roles & Permissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setApiResponses();
  });

  it("loads roles and permission state from the API", async () => {
    render(<AdminRolesPermissions />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading roles and permissions...");
    expect(await screen.findByRole("heading", { name: "Administrator" })).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith("/api/admin/roles");
    expect(apiClient.get).toHaveBeenCalledWith("/api/admin/permissions");
    expect(await screen.findByRole("checkbox", { name: "assets.view permission" })).toBeChecked();
    expect(apiClient.get).toHaveBeenCalledWith("/api/admin/roles/admin/permissions");
    expect(screen.getByRole("checkbox", { name: "assets.create permission" })).not.toBeChecked();
    expect(screen.getByRole("columnheader", { name: "Create" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Configure" })).toBeInTheDocument();
  });

  it("loads the selected role permissions and persists changes through the API", async () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    apiClient.put.mockResolvedValue({
      data: {
        success: true,
        data: { role: "admin", permissions: ["assets.view", "roles.view", "assets.create"] },
        permissions: ["assets.view", "roles.view", "assets.create"],
      },
    });

    render(<AdminRolesPermissions />);
    const createPermission = await screen.findByRole("checkbox", { name: "assets.create permission" });
    await waitFor(() => expect(createPermission).toBeEnabled());
    fireEvent.click(screen.getByRole("checkbox", { name: "assets.create permission" }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "assets.create permission" })).toBeChecked());
    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith(
      "/api/admin/roles/admin/permissions",
      { permissions: ["assets.view", "roles.view", "assets.create"] },
    ));
    expect(await screen.findByRole("status")).toHaveTextContent("Permissions updated successfully.");
    expect(confirmSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /ICT Officer/ }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith("/api/admin/roles/ict_officer/permissions"));
    expect(screen.getByRole("checkbox", { name: "assets.view permission" })).toBeChecked();
    confirmSpy.mockRestore();
  });

  it("shows the required load error when roles or permissions cannot be loaded", async () => {
    apiClient.get.mockRejectedValue(new Error("network error"));

    render(<AdminRolesPermissions />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load roles and permissions. Please try again.",
    );
  });
});
