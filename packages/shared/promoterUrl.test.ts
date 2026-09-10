import { expect, it } from "vitest";
import { buildPermanentPromoterUrl } from "./promoterUrl";
const id = "11111111-1111-4111-8111-111111111111";
it.each([
  "http://localhost:3001",
  "https://preview.example.test",
  "https://babyclubaccess.com",
])("preserves the configured landing environment %s", (origin) =>
  expect(buildPermanentPromoterUrl(id, origin)).toBe(`${origin}/p/${id}`),
);
it("requires a configured origin and never falls back to production", () =>
  expect(() => buildPermanentPromoterUrl(id, "")).toThrow());
it("rejects script or credential URLs", () => {
  expect(() => buildPermanentPromoterUrl(id, "javascript:alert(1)")).toThrow();
  expect(() =>
    buildPermanentPromoterUrl(id, "https://a:b@example.test"),
  ).toThrow();
});
