import { describe, expect, it } from "vitest";
import { parseFlexibleDate } from "../dates";

describe("parseFlexibleDate", () => {
  it("parses ISO dates unambiguously", () => {
    expect(parseFlexibleDate("2026-07-16")).toEqual({ iso: "2026-07-16", ambiguous: false });
    expect(parseFlexibleDate("2026/7/3")).toEqual({ iso: "2026-07-03", ambiguous: false });
  });

  it("parses textual months", () => {
    expect(parseFlexibleDate("16 Jul 2026").iso).toBe("2026-07-16");
    expect(parseFlexibleDate("Jul 16, 2026").iso).toBe("2026-07-16");
    expect(parseFlexibleDate("3-March-26").iso).toBe("2026-03-03");
  });

  it("flags 03/04/2026 as ambiguous and honours the requested order", () => {
    expect(parseFlexibleDate("03/04/2026", "DMY")).toEqual({ iso: "2026-04-03", ambiguous: true });
    expect(parseFlexibleDate("03/04/2026", "MDY")).toEqual({ iso: "2026-03-04", ambiguous: true });
  });

  it("is unambiguous when one part exceeds 12", () => {
    expect(parseFlexibleDate("16/04/2026")).toEqual({ iso: "2026-04-16", ambiguous: false });
    expect(parseFlexibleDate("04/16/2026")).toEqual({ iso: "2026-04-16", ambiguous: false });
  });

  it("treats equal day/month as unambiguous", () => {
    expect(parseFlexibleDate("3/3/26")).toEqual({ iso: "2026-03-03", ambiguous: false });
  });

  it("rejects impossible dates", () => {
    expect(parseFlexibleDate("31/02/2026").iso).toBeNull();
    expect(parseFlexibleDate("not a date").iso).toBeNull();
  });

  it("expands 2-digit years around the 1970 pivot", () => {
    expect(parseFlexibleDate("16/07/26").iso).toBe("2026-07-16");
    expect(parseFlexibleDate("16/07/85").iso).toBe("1985-07-16");
  });
});
