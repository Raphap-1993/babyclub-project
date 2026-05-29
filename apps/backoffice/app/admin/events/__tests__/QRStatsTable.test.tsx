import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QRStatsTable } from "../components/QRStatsTable";

const mockData = [
  {
    event_id: "evt1",
    name: "Fiesta Enero",
    date: "2026-01-15",
    total_qr: 120,
    sold_qr: 100,
    free_qr: 12,
    courtesy_qr: 3,
    table_qr: 5,
    table_count: 2,
    by_type: { sold: 100, free: 12, courtesy: 3, table: 5 },
  },
  {
    event_id: "evt2",
    name: "Fiesta Febrero",
    date: "2026-02-10",
    total_qr: 80,
    sold_qr: 60,
    free_qr: 10,
    courtesy_qr: 2,
    table_qr: 8,
    table_count: 3,
    by_type: { sold: 60, free: 10, courtesy: 2, table: 8 },
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
    expect(html).toContain(">12<");
    expect(html).toContain(">3<");
    expect(html).toContain(">5<");
    expect(html).toContain(">2<");
    expect(html).toContain(">80<");
    expect(html).toContain(">60<");
    expect(html).toContain(">10<");
    expect(html).toContain(">8<");
    expect(html).toContain(">3<");
  });
});
