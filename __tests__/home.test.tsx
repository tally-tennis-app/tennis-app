import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("Home", () => {
  it("introduces the score-led tennis community", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Your court. Your crew. Every score counts.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Foundation in progress")).toBeInTheDocument();
    expect(
      screen.getByText(/Log verified matches, follow fair standings/i),
    ).toBeInTheDocument();
  });

  it("summarizes the first product loop", () => {
    render(<Home />);

    expect(screen.getByText("Log the score")).toBeInTheDocument();
    expect(screen.getByText("Confirm the result")).toBeInTheDocument();
    expect(screen.getByText("Watch the table move")).toBeInTheDocument();
  });
});
