import { describe, it, expect } from "vitest";
import {
  safeMercadoPagoChallengeUrl,
  isMercadoPagoChallengeComplete,
} from "./mercadopagoChallenge";

const url =
  "https://www.mercadopago.com.pe/auth/card/validation/pages/remedies/test-id?guest_token=synthetic";
describe("3DS trust boundary", () => {
  it("only embeds canonical HTTPS challenge pages on the provider", () => {
    expect(safeMercadoPagoChallengeUrl(url)).toBe(url);
    for (const bad of [
      "javascript:alert(1)",
      url.replace("https:", "http:"),
      url.replace(".com.pe", ".com.pe.attacker.test"),
      url.replace("www.", "evil@www."),
      url.replace("/auth/card/validation/pages/remedies/test-id", "/other"),
      "https://127.0.0.1/auth/card/validation/pages/remedies/1",
      url.replace(".pe/", ".pe:8443/"),
    ])
      expect(safeMercadoPagoChallengeUrl(bad)).toBeNull();
  });
  it("accepts completion only from the current challenge frame and origin", () => {
    const frame = {};
    const event = {
      source: frame,
      origin: new URL(url).origin,
      data: { status: "COMPLETE" },
    };
    expect(isMercadoPagoChallengeComplete(event, frame, url)).toBe(true);
    expect(
      isMercadoPagoChallengeComplete({ ...event, source: {} }, frame, url),
    ).toBe(false);
    expect(
      isMercadoPagoChallengeComplete(
        { ...event, origin: "https://attacker.test" },
        frame,
        url,
      ),
    ).toBe(false);
    expect(
      isMercadoPagoChallengeComplete({ ...event, data: null }, frame, url),
    ).toBe(false);
    expect(isMercadoPagoChallengeComplete(event, null, url)).toBe(false);
  });
});
