import { describe, expect, it } from "vitest";
import { testFn } from ".";

describe("testFn", () => {
  it("should return 4", () => {
    expect(testFn()).toEqual(4);
  });
});
