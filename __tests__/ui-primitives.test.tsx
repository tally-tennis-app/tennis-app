import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Alert } from "@/src/components/ui/feedback";
import { Field } from "@/src/components/ui/field";
import { Badge, initials, RoleBadge } from "@/src/components/ui/structure";

describe("Field", () => {
  it("labels the control and describes it with its hint and error", () => {
    render(
      <Field
        label="Group name"
        name="name"
        hint="Up to 60 characters."
        error="Give the group a name."
      />,
    );

    const input = screen.getByLabelText("Group name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "Up to 60 characters. Give the group a name.",
    );
  });

  it("lets a password be revealed without renaming the field", async () => {
    render(
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
      />,
    );

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    await userEvent.click(
      screen.getByRole("button", { name: "Show password" }),
    );

    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("name", "password");
    expect(input).toHaveAttribute("autocomplete", "current-password");
    expect(
      screen.getByRole("button", { name: "Hide password" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

describe("status primitives", () => {
  it("always carry their meaning as text", () => {
    render(
      <>
        <Badge tone="warning">Pending</Badge>
        <RoleBadge role="organizer" />
        <Alert tone="critical">That invite code is not valid</Alert>
      </>,
    );

    expect(screen.getByText("Pending")).toBeVisible();
    expect(screen.getByText("Organizer")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "That invite code is not valid",
    );
  });

  it("derives initials from one or several names", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("  bo  ")).toBe("BO");
    expect(initials("Jean Luc Picard")).toBe("JP");
    expect(initials("")).toBe("?");
  });
});
