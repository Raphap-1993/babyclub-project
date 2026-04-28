import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QRStatsTable } from "../components/QRStatsTable";

const mockData = [
  {
    event_id: "evt1",
    name: "Fiesta Enero",
    date: "2026-01-15",
    total_qr: 120,
    by_type: { entrada: 100, mesa: 15, cortesia: 5 },
  },
  {
    event_id: "evt2",
    name: "Fiesta Febrero",
    date: "2026-02-10",
    total_qr: 80,
    by_type: { entrada: 60, mesa: 18, cortesia: 2 },
  },
];

describe("QRStatsTable", () => {
  it("muestra los eventos y el breakdown de QRs", () => {
    const html = renderToStaticMarkup(<QRStatsTable events={mockData} />);

    expect(html).toContain("Fiesta Enero");
    expect(html).toContain("Fiesta Febrero");
    expect(html).toContain("2026-01-15");
    expect(html).toContain("2026-02-10");
    expect(html).toContain(">120<");
    expect(html).toContain(">100<");
    expect(html).toContain(">15<");
    expect(html).toContain(">5<");
    expect(html).toContain(">80<");
    expect(html).toContain(">60<");
    expect(html).toContain(">18<");
    expect(html).toContain(">2<");
  });
});
