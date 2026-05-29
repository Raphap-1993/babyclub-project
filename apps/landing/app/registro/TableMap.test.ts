import { describe, expect, it } from "vitest";
import {
  MAP_VIEWBOX,
  getFocusedDisplayViewBox,
  getFullDisplayViewBox,
  type MapSlot,
} from "./TableMap";

describe("TableMap focus framing", () => {
  it("acerca la vista cuando las mesas ocupan solo una zona del croquis", () => {
    const slots: MapSlot[] = [
      {
        id: "mesa-1",
        label: "1",
        x: 120,
        y: 220,
        w: 80,
        h: 80,
        status: "available",
      },
      {
        id: "mesa-2",
        label: "2",
        x: 260,
        y: 240,
        w: 80,
        h: 80,
        status: "available",
      },
      {
        id: "mesa-3",
        label: "3",
        x: 410,
        y: 260,
        w: 80,
        h: 80,
        status: "available",
      },
    ];

    const focused = getFocusedDisplayViewBox(slots, MAP_VIEWBOX, "default");
    const full = getFullDisplayViewBox(MAP_VIEWBOX);

    expect(focused.width).toBeLessThan(full.width);
    expect(focused.height).toBeLessThan(full.height);
    expect(focused.x).toBeGreaterThanOrEqual(0);
    expect(focused.y).toBeGreaterThanOrEqual(0);
  });

  it("mantiene las mesas dentro del viewBox enfocado en mobile", () => {
    const slots: MapSlot[] = [
      {
        id: "mesa-1",
        label: "1",
        x: 760,
        y: 1080,
        w: 90,
        h: 90,
        status: "available",
      },
    ];

    const focused = getFocusedDisplayViewBox(slots, MAP_VIEWBOX, "mobile");

    expect(focused.x).toBeLessThanOrEqual(slots[0].x);
    expect(focused.y).toBeLessThanOrEqual(slots[0].y);
    expect(focused.x + focused.width).toBeGreaterThanOrEqual(
      slots[0].x + slots[0].w,
    );
    expect(focused.y + focused.height).toBeGreaterThanOrEqual(
      slots[0].y + slots[0].h,
    );
  });
});
