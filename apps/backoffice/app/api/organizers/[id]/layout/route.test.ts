import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../../tests/utils/supabaseMock";

vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");

describe("PUT /api/organizers/[id]/layout", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://internal-supabase:54321";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("omite layout_canvas_* cuando la fila del organizer no expone esas columnas", async () => {
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: { role: "admin" },
    });

    const { supabase, calls } = createSupabaseMock({
      "organizers.select": [
        { data: { id: "org-1", layout_url: "old-layout.png" }, error: null },
      ],
      "tables.select": [
        {
          data: {
            id: "table-1",
            organizer_id: "org-1",
            layout_x: 100,
            layout_y: 120,
            layout_size: 60,
            pos_x: 10,
            pos_y: 10,
            pos_w: 9,
            pos_h: 6,
          },
          error: null,
        },
      ],
      "tables.update": [
        { data: null, error: null },
        { data: null, error: null },
      ],
      "organizers.update": [{ data: null, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);

    const { PUT } = await import("./route");
    const req = {
      json: async () => ({
        layout_url: "new-layout.png",
        canvas_width: 1200,
        canvas_height: 800,
        updates: [
          { tableId: "table-1", layout_x: 240, layout_y: 320, layout_size: 72 },
        ],
      }),
    } as any;

    const res = await PUT(req, { params: Promise.resolve({ id: "org-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(createClient).toHaveBeenCalledWith(
      "http://internal-supabase:54321",
      "test-key",
      expect.any(Object),
    );

    const organizerUpdateCall = calls.find(
      (call) => call.table === "organizers" && call.op === "update",
    );
    expect(organizerUpdateCall?.payload).toEqual({
      layout_url: "new-layout.png",
    });

    const tableUpdateCalls = calls.filter(
      (call) => call.table === "tables" && call.op === "update",
    );
    expect(tableUpdateCalls).toHaveLength(2);
    expect(tableUpdateCalls[0].payload).toEqual({
      layout_x: 240,
      layout_y: 320,
      layout_size: 72,
    });
    expect(tableUpdateCalls[1].payload).toEqual({
      pos_x: 17,
      pos_y: 35.5,
      pos_w: 6,
      pos_h: 9,
    });
  });
});
