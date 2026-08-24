import { describe, expect, it } from "vitest";
import {
  INPI_COMPANY_CACHE_TTL_SECONDS,
  inpiCompanyCacheKey,
} from "@/lib/providers/inpi-rne";

describe("INPI shared cache v0.5.10", () => {
  it("uses a versioned company cache shared across serverless instances", () => {
    expect(inpiCompanyCacheKey("123456789")).toBe("inpi-rne:company:v2:123456789");
    expect(INPI_COMPANY_CACHE_TTL_SECONDS).toBe(60 * 60);
  });
});
