import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { numberblocksApi, ALL_STRATEGIES } from "@/lib/api/numberblocks";

const invoke = vi.mocked(supabase.functions.invoke);

beforeEach(() => {
  invoke.mockReset();
});

describe("numberblocksApi.scrapeImages", () => {
  it("uses scrape-numberblocks for auto strategy (single number)", async () => {
    invoke.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            number: 5,
            imageUrl: "https://example.com/5.png",
            pageUrl: "https://numberblocks.fandom.com/wiki/5",
          },
        ],
      },
      error: null,
    });

    const result = await numberblocksApi.scrapeImages(5, 5, "auto");

    expect(invoke).toHaveBeenCalledWith("scrape-numberblocks", {
      body: { startNumber: 5, endNumber: 5, isSingleNumber: true, strategy: "auto" },
    });
    expect(result).toEqual({
      success: true,
      data: [
        {
          number: 5,
          imageUrl: "https://example.com/5.png",
          pageUrl: "https://numberblocks.fandom.com/wiki/5",
        },
      ],
    });
  });

  it("calls generate-svg-numberblock for single + svg strategy", async () => {
    invoke.mockResolvedValueOnce({
      data: {
        success: true,
        imageUrl: "https://x/svg.png",
        svgGenerated: true,
      },
      error: null,
    });

    const result = await numberblocksApi.scrapeImages(3, 3, "svg");

    expect(invoke).toHaveBeenCalledWith("generate-svg-numberblock", {
      body: { number: 3, force: true },
    });
    expect(result.success).toBe(true);
    expect(result.data?.[0]).toMatchObject({
      number: 3,
      imageUrl: "https://x/svg.png",
      svgGenerated: true,
    });
  });

  it("calls compose-numberblock for single + compose strategy", async () => {
    invoke.mockResolvedValueOnce({
      data: { success: true, imageUrl: "https://x/c.png", aiGenerated: true },
      error: null,
    });

    await numberblocksApi.scrapeImages(10, 10, "compose");

    expect(invoke).toHaveBeenCalledWith("compose-numberblock", {
      body: { number: 10, force: true },
    });
  });

  it("calls generate-gemini-numberblock for single + ai-gemini", async () => {
    invoke.mockResolvedValueOnce({
      data: {
        success: true,
        imageUrl: "https://x/g.png",
        aiGenerated: true,
        generationMethod: "gemini",
      },
      error: null,
    });

    const result = await numberblocksApi.scrapeImages(2, 2, "ai-gemini");

    expect(invoke).toHaveBeenCalledWith("generate-gemini-numberblock", {
      body: { number: 2, force: true },
    });
    expect(result.data?.[0]?.generationMethod).toBe("gemini");
  });

  it("infers gemini when response omits generationMethod for ai-gemini strategy", async () => {
    invoke.mockResolvedValueOnce({
      data: {
        success: true,
        imageUrl: "https://x/g.png",
        aiGenerated: true,
      },
      error: null,
    });

    const result = await numberblocksApi.scrapeImages(2, 2, "ai-gemini");

    expect(result.data?.[0]?.generationMethod).toBe("gemini");
  });

  it("calls generate-numberblock for single + ai-openai and infers openai when omitted", async () => {
    invoke.mockResolvedValueOnce({
      data: { success: true, imageUrl: "https://x/o.png", aiGenerated: true },
      error: null,
    });

    const result = await numberblocksApi.scrapeImages(7, 7, "ai-openai");

    expect(invoke).toHaveBeenCalledWith("generate-numberblock", {
      body: { number: 7, force: true },
    });
    expect(result.data?.[0]?.generationMethod).toBe("openai");
  });

  it("returns error when direct generation invoke fails", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "network down" },
    });

    const result = await numberblocksApi.scrapeImages(1, 1, "svg");

    expect(result).toEqual({ success: false, error: "network down" });
  });

  it("returns error when direct generation response has no imageUrl", async () => {
    invoke.mockResolvedValueOnce({
      data: { success: false, error: "bad" },
      error: null,
    });

    const result = await numberblocksApi.scrapeImages(1, 1, "svg");

    expect(result).toEqual({ success: false, error: "bad" });
  });

  it("uses scrape-numberblocks for wiki-only single number", async () => {
    invoke.mockResolvedValueOnce({ data: { success: true, data: [] }, error: null });

    await numberblocksApi.scrapeImages(4, 4, "wiki-only");

    expect(invoke).toHaveBeenCalledWith("scrape-numberblocks", {
      body: { startNumber: 4, endNumber: 4, isSingleNumber: true, strategy: "wiki-only" },
    });
  });

  it("uses scrape-numberblocks for a range", async () => {
    invoke.mockResolvedValueOnce({ data: { success: true, data: [] }, error: null });

    await numberblocksApi.scrapeImages(1, 3, "auto");

    expect(invoke).toHaveBeenCalledWith("scrape-numberblocks", {
      body: { startNumber: 1, endNumber: 3, isSingleNumber: false, strategy: "auto" },
    });
  });

  it("returns scrape error when scrape-numberblocks fails", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "rate limit" },
    });

    const result = await numberblocksApi.scrapeImages(1, 2, "auto");

    expect(result).toEqual({ success: false, error: "rate limit" });
  });
});

describe("numberblocksApi helpers", () => {
  it("generateWithAI forwards errors", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "fail" } });
    await expect(numberblocksApi.generateWithAI(5)).resolves.toEqual({
      success: false,
      error: "fail",
    });
  });

  it("generateWithAI returns data on success", async () => {
    invoke.mockResolvedValueOnce({
      data: { success: true, imageUrl: "https://img", aiGenerated: true },
      error: null,
    });
    await expect(numberblocksApi.generateWithAI(4)).resolves.toEqual({
      success: true,
      imageUrl: "https://img",
      aiGenerated: true,
    });
  });

  it("regenerate calls generate-numberblock with force", async () => {
    invoke.mockResolvedValueOnce({ data: { success: true, imageUrl: "u" }, error: null });
    await numberblocksApi.regenerate(9);
    expect(invoke).toHaveBeenCalledWith("generate-numberblock", {
      body: { number: 9, force: true },
    });
  });

  it("regenerate forwards invoke errors", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "nope" } });
    await expect(numberblocksApi.regenerate(3)).resolves.toEqual({
      success: false,
      error: "nope",
    });
  });

  it("generateSVG invokes svg function", async () => {
    invoke.mockResolvedValueOnce({ data: { success: true, imageUrl: "u" }, error: null });
    await numberblocksApi.generateSVG(8);
    expect(invoke).toHaveBeenCalledWith("generate-svg-numberblock", { body: { number: 8 } });
  });

  it("generateSVG forwards invoke errors", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "svg fail" } });
    await expect(numberblocksApi.generateSVG(1)).resolves.toEqual({
      success: false,
      error: "svg fail",
    });
  });

  it("generateWithGemini invokes gemini function", async () => {
    invoke.mockResolvedValueOnce({ data: { success: true, imageUrl: "u" }, error: null });
    await numberblocksApi.generateWithGemini(11);
    expect(invoke).toHaveBeenCalledWith("generate-gemini-numberblock", { body: { number: 11 } });
  });

  it("generateWithGemini forwards invoke errors", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "gem err" } });
    await expect(numberblocksApi.generateWithGemini(2)).resolves.toEqual({
      success: false,
      error: "gem err",
    });
  });

  it("compareAllStrategies runs one scrape per ALL_STRATEGIES entry", async () => {
    invoke.mockResolvedValue({ data: { success: true, data: [] }, error: null });

    const rows = await numberblocksApi.compareAllStrategies(42);

    expect(rows).toHaveLength(ALL_STRATEGIES.length);
    expect(rows.map((r) => r.strategy)).toEqual(ALL_STRATEGIES.map((s) => s.value));
    expect(invoke).toHaveBeenCalled();
  });
});
