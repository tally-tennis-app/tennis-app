import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("Home", () => {
  it("leads with the value proposition and both account actions", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Scores both players agree on.",
      }),
    ).toBeInTheDocument();
    for (const name of ["Create account", "Sign in"]) {
      expect(screen.getAllByRole("link", { name })[0]).toHaveAttribute(
        "href",
        name === "Sign in" ? "/login" : "/signup",
      );
    }
  });

  it("tells the verification story and labels its examples", () => {
    render(<Home />);

    for (const verb of ["Log", "Confirm", "Rank"]) {
      expect(
        screen.getByRole("heading", { level: 3, name: verb }),
      ).toBeVisible();
    }
    expect(
      screen.getByRole("group", {
        name: "Priya Raman beat Tomás Ortega 6-4 3-6 7-6(5)",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("An example of a confirmed match.")).toBeVisible();
  });
});
