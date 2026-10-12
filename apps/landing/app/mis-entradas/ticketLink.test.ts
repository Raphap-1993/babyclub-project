import { describe, expect, it } from "vitest";
import { getLocalTicketLink } from "./ticketLink";

const id = "f43c1e33-393b-48b4-9bd3-c85f8cd7fc91";
const origin = "http://localhost:3001";
describe("received ticket link", () => {
  it("opens an existing ticket link locally while preserving its proof parameters", () => {
    expect(
      getLocalTicketLink(
        `https://babyclubaccess.com/ticket/${id}?token=proof`,
        origin,
      ),
    ).toBe(`/ticket/${id}?token=proof`);
    expect(getLocalTicketLink(`/compra/reserva/${id}`, origin)).toBe(
      `/compra/reserva/${id}`,
    );
  });
  it("rejects external, credentialed and executable URLs, redirects and arbitrary routes", () => {
    for (const value of [
      `https://other.example/ticket/${id}`,
      `https://u:p@babyclubaccess.com/ticket/${id}`,
      "javascript:alert(1)",
      "//other.example/ticket/" + id,
      "/compra?redirect=https://other.example",
      "/ticket/not-an-id",
      "https://babyclubaccess.com.evil.example/ticket/" + id,
    ]) {
      expect(getLocalTicketLink(value, origin)).toBeNull();
    }
  });
});
