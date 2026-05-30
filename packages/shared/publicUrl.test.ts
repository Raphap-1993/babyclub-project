import { beforeEach, describe, expect, it, vi } from "vitest";

describe("getPublicAppUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_LANDING_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_ENV;
  });

  it("ignora localhost y usa el fallback público", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
    const { getPublicAppUrl } = await import("./publicUrl");
    expect(getPublicAppUrl()).toBe("https://babyclubaccess.com");
  });

  it("usa la url pública cuando está configurada", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://babyclubaccess.com";
    const { getPublicAppUrl } = await import("./publicUrl");
    expect(getPublicAppUrl()).toBe("https://babyclubaccess.com");
  });

  it("prefiere la url de producción de vercel si app url es local", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "babyclubaccess.com";
    const { getPublicAppUrl } = await import("./publicUrl");
    expect(getPublicAppUrl()).toBe("https://babyclubaccess.com");
  });

  it("ignora hosts preview de vercel para links públicos", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL =
      "babyclub-backoffice-b5kque4ky-raphaels-projects-0f60af52.vercel.app";
    const { getPublicAppUrl } = await import("./publicUrl");
    expect(getPublicAppUrl()).toBe("https://babyclubaccess.com");
  });
});

describe("getPublicLandingUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_LANDING_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_ENV;
  });

  it("prefiere la url pública de landing sobre panel", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://panel.babyclubaccess.com";
    process.env.NEXT_PUBLIC_LANDING_URL = "https://babyclubaccess.com";
    const { getPublicLandingUrl } = await import("./publicUrl");
    expect(getPublicLandingUrl()).toBe("https://babyclubaccess.com");
  });

  it("ignora panel cuando landing no está disponible y usa el fallback público", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://panel.babyclubaccess.com";
    const { getPublicLandingUrl } = await import("./publicUrl");
    expect(getPublicLandingUrl()).toBe("https://babyclubaccess.com");
  });

  it("ignora hosts preview de vercel y usa el fallback público", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL =
      "babyclub-backoffice-b5kque4ky-raphaels-projects-0f60af52.vercel.app";
    const { getPublicLandingUrl } = await import("./publicUrl");
    expect(getPublicLandingUrl()).toBe("https://babyclubaccess.com");
  });
});
