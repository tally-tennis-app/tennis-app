import { describe, expect, it } from "vitest";

describe("web app manifest", () => {
  it("describes an installable standalone app", async () => {
    const manifestModule = await import("@/app/manifest");
    const manifest = manifestModule.default();

    expect(manifest).toMatchObject({
      name: "Tennis App",
      short_name: "Tennis",
      start_url: "/",
      display: "standalone",
      background_color: "#f0eee5",
      theme_color: "#102721",
    });
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/icon-192.png", sizes: "192x192" }),
        expect.objectContaining({ src: "/icon-512.png", sizes: "512x512" }),
      ]),
    );
  });
});
