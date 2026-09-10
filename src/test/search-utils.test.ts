import { describe, expect, it } from "vitest";
import { fuzzyTextScore } from "@/lib/search-utils";

describe("fuzzyTextScore", () => {
  it("ignora espacios ausentes", () => {
    expect(fuzzyTextScore("YosuganoSora", ["Yosuga no Sora"])).toBeGreaterThan(5);
  });

  it("tolera errores ortográficos pequeños", () => {
    expect(fuzzyTextScore("Yosuga no Sra", ["Yosuga no Sora"])).toBeGreaterThan(3);
    expect(fuzzyTextScore("One Pice", ["One Piece"])).toBeGreaterThan(3);
  });
});