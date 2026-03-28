import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges tailwind classes and resolves conflicts (later wins)", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("handles conditional class lists", () => {
    expect(cn("base", false && "hidden", true && "block")).toBe("base block");
  });

  it("flattens arrays and ignores falsy values", () => {
    expect(cn(["a", "b"], undefined, null)).toBe("a b");
  });
});
