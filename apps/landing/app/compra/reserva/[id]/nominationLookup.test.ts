import { describe, expect, it, vi } from "vitest";
import { lookupNominationPerson } from "./nominationLookup";

describe("lookupNominationPerson", () => {
  it("prioritizes the shared persons endpoint and normalizes the returned person", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        person: {
          first_name: "Ana Maria",
          last_name: "Perez Soto",
          email: "ana@example.com",
          phone: "999888777",
        },
      }),
    });

    await expect(
      lookupNominationPerson({
        document: "12345678",
        docType: "dni",
        fetchImpl: fetchMock as any,
      }),
    ).resolves.toEqual({
      full_name: "Ana Maria Perez Soto",
      email: "ana@example.com",
      phone: "999888777",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/persons?document=12345678&doc_type=dni",
      { cache: "no-store" },
    );
  });

  it("rejects invalid documents before hitting the network", async () => {
    const fetchMock = vi.fn();

    await expect(
      lookupNominationPerson({
        document: "1234",
        docType: "dni",
        fetchImpl: fetchMock as any,
      }),
    ).rejects.toThrow("Ingresa un DNI valido de 8 digitos.");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces backend lookup errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "Documento no encontrado",
      }),
    });

    await expect(
      lookupNominationPerson({
        document: "12345678",
        docType: "dni",
        fetchImpl: fetchMock as any,
      }),
    ).rejects.toThrow("Documento no encontrado");
  });
});
