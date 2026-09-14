import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("system pages", () => {
  it("offers a retry after an unexpected error", async () => {
    const { default: ErrorPage } = await import("@/app/error");
    const retry = vi.fn();
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    render(
      <ErrorPage
        error={Object.assign(new Error("test failure"), {
          digest: "digest-123",
        })}
        retry={retry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      screen.getByRole("heading", { name: "The ball clipped the net." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Reference: digest-123")).toBeInTheDocument();
    expect(retry).toHaveBeenCalledOnce();
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith("/api/errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Error",
        message: "test failure",
        digest: "digest-123",
        pathname: "/",
      }),
      keepalive: true,
    });
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
