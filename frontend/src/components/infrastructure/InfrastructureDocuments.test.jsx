import React from "react";
import { render, screen } from "@testing-library/react";
import InfrastructureDocuments from "./InfrastructureDocuments";

test("explains that infrastructure document links require a compatible schema", () => {
  render(<InfrastructureDocuments />);

  expect(screen.getByRole("heading", { name: "Infrastructure Documents" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("TODO: add an Infrastructure-compatible document relationship and API");
});
