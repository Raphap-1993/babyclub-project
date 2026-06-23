import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

describe("codes.person_index migrations", () => {
  it("incluye una migracion que permite mas de 10 QR por reserva de mesa", () => {
    const migrationsDir = path.join(__dirname, "migrations");
    const migrationSql = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
      .join("\n");

    expect(migrationSql).toMatch(
      /drop\s+constraint\s+if\s+exists\s+codes_person_index_check/i,
    );
    expect(migrationSql).toMatch(
      /add\s+constraint\s+codes_person_index_check\s+check\s*\(\s*person_index\s*>=\s*1\s*\)/i,
    );
    expect(migrationSql).toMatch(/where\s+id\s*=\s*'event-assets'/i);
    expect(migrationSql).toMatch(/'image\/heic'/i);
    expect(migrationSql).toMatch(/'image\/heif'/i);
    expect(migrationSql).toMatch(/'image\/avif'/i);
  });
});
