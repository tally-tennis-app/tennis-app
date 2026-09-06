import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("system pages", () => {
  it("offers a retry after an unexpected error", async () => {
    const { default: ErrorPage } = await import("@/app/error");
    const retry = vi.fn();

    render(<ErrorPage error={new Error("test failure")} retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      screen.getByRole("heading", { name: "The ball clipped the net." }),
    ).toBeInTheDocument();
    expect(retry).toHaveBeenCalledOnce();
  });

  it("links an unknown route back to the home court", async () => {
    const { default: NotFound } = await import("@/app/not-found");

    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: "This court is empty." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
