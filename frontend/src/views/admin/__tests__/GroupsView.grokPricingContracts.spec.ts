import { describe, expect, it } from "vitest";

const groupsViewSource = await import("../GroupsView.vue?raw").then(
  (module) => module.default,
);

describe("GroupsView Grok pricing contracts", () => {
  it("keeps create and edit controls for every Grok explicit pricing field", () => {
    for (const mode of ["create", "edit"]) {
      expect(groupsViewSource).toContain(
        `v-model.number="${mode}Form.search_price_per_1k"`,
      );
      expect(groupsViewSource).toContain(
        `v-model.number="${mode}Form.audio_realtime_price_per_min"`,
      );
      expect(groupsViewSource).toContain(
        `v-model.number="${mode}Form.audio_tts_price_per_million_chars"`,
      );
      expect(groupsViewSource).toContain(
        `v-model.number="${mode}Form.audio_stt_price_per_hour"`,
      );
      expect(groupsViewSource).toContain(
        `data-testid="${mode}-grok-video-model-prices"`,
      );
    }
  });

  it("serializes create and edit per-model video pricing", () => {
    expect(groupsViewSource).toContain(
      "video_model_prices: serializeVideoModelPrices(\n        createForm.video_model_prices,",
    );
    expect(groupsViewSource).toContain(
      "video_model_prices: serializeVideoModelPrices(\n        editForm.video_model_prices,",
    );
  });
});
