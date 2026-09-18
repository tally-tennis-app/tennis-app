import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TennyLockup, TennyMark } from "@/src/components/brand";

describe("Tenny brand images", () => {
  it("drops to the flat ball below 32px, per the brand rules", () => {
    render(
      <>
        <TennyMark height={24} alt="small" />
        <TennyMark height={48} alt="large" />
      </>,
    );

    expect(screen.getByAltText("small")).toHaveAttribute(
      "src",
      "/brand/tenny-ball-flat.svg",
    );
    expect(screen.getByAltText("large")).toHaveAttribute(
      "src",
      "/brand/tenny-mark.svg",
    );
  });

  it("keeps the lockup ratio and offers a reversed dark source", () => {
    const { container } = render(<TennyLockup height={40} />);

    expect(screen.getByAltText("Tenny")).toHaveAttribute("width", "209");
    expect(container.querySelector("source")).toHaveAttribute(
      "srcset",
      "/brand/tenny-lockup-horizontal-reversed.svg",
    );
  });
});
