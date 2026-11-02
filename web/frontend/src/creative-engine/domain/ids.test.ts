import { describe, expect, it } from "vitest";
import { createId, isId } from "./ids.ts";

describe("identifiants", () => {
  it("produit des UUID v4 en minuscules", () => {
    const id = createId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(isId(id)).toBe(true);
  });

  it("ne produit pas de doublon sur 10 000 tirages", () => {
    const ids = new Set(Array.from({ length: 10_000 }, createId));
    expect(ids.size).toBe(10_000);
  });

  it("refuse ce qui n'est pas un UUID", () => {
    for (const value of ["", "abc", "E0000000-0000-4000-8000-000000000001", 42, null, undefined]) {
      expect(isId(value)).toBe(false);
    }
  });
});
