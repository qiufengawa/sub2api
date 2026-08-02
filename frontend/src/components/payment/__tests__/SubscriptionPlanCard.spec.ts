import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import type { SubscriptionPlan } from "@/types/payment";
import SubscriptionPlanCard from "../SubscriptionPlanCard.vue";

const i18n = createI18n({
  legacy: false,
  locale: "en",
  fallbackWarn: false,
  missingWarn: false,
  messages: {
    en: {
      payment: {
        days: "days",
        weeks: "weeks",
        months: "months",
        perMonth: "month",
        models: "Models",
        planCard: {
          price: "Price",
          validity: "Validity",
          quota: "Quota",
          rate: "Rate",
          unlimited: "Unlimited",
        },
        subscribeNow: "Subscribe now",
      },
    },
  },
});

const mountPlanCard = (groupPlatform: string, overrides: Partial<SubscriptionPlan> = {}) =>
  mount(SubscriptionPlanCard, {
    props: {
      plan: {
        id: 1,
        group_id: 10,
        group_platform: groupPlatform,
        name: "Pro",
        price: 10,
        amount: 1000,
        features: [],
        rate_multiplier: 1,
        validity_days: 30,
        validity_unit: "day",
        supported_model_scopes: ["claude", "gemini_text", "gemini_image"],
        is_active: true,
        ...overrides,
      },
    },
    global: { plugins: [i18n, createPinia()] },
  });

describe("SubscriptionPlanCard", () => {
  it("does not show Antigravity model scopes for OpenAI plans", () => {
    const text = mountPlanCard("openai").text();

    expect(text).not.toContain("Claude");
    expect(text).not.toContain("Gemini");
    expect(text).not.toContain("Imagen");
  });

  it("shows model scopes for Antigravity plans", () => {
    const wrapper = mountPlanCard("antigravity");
    const text = wrapper.text();
    const badges = wrapper.findAll(".plan-card-model-scope-badge");

    expect(text).toContain("Claude");
    expect(text).toContain("Gemini");
    expect(text).toContain("Imagen");
    expect(badges).toHaveLength(3);
    expect(badges[0].classes()).toEqual(expect.arrayContaining(["bg-orange-50", "text-orange-700"]));
    expect(badges[1].classes()).toEqual(expect.arrayContaining(["bg-blue-50", "text-blue-700"]));
    expect(badges[2].classes()).toEqual(expect.arrayContaining(["bg-violet-50", "text-violet-700"]));
  });

  it("renders Composite as a cyan platform badge", () => {
    const badge = mountPlanCard("composite").get(".plan-card-platform-badge");

    expect(badge.text()).toContain("Composite");
    expect(badge.classes()).toEqual(expect.arrayContaining([
      "border-cyan-500/30",
      "bg-cyan-500/10",
      "text-cyan-700",
    ]));
  });

  // #4607: admin forms persist plural units; keep every validity branch intact.
  it("renders plural admin-form validity units instead of mislabeled days (#4607)", () => {
    expect(mountPlanCard("openai", { validity_days: 1, validity_unit: "months" }).text()).toContain("payment.perMonth");
    expect(mountPlanCard("openai", { validity_days: 3, validity_unit: "months" }).text()).toContain("3payment.months");
    expect(mountPlanCard("openai", { validity_days: 2, validity_unit: "weeks" }).text()).toContain("2payment.weeks");
    expect(mountPlanCard("openai", { validity_days: 30, validity_unit: "day" }).text()).toContain("30payment.days");
  });

  it("uses the configured currency symbol while preserving USD for legacy plans", () => {
    const cnyPlan = mountPlanCard("openai", { currency: "CNY", original_price: 20 }).text();

    expect(cnyPlan).toContain("¥10CNY");
    expect(cnyPlan).toContain("¥20");
    expect(mountPlanCard("openai", { currency: "USD" }).text()).toContain("$10USD");
    expect(mountPlanCard("openai", { currency: "" }).text()).toContain("$10");
  });

  it.each([
    ["long Chinese", "企业全球加速专业订阅套餐（含高级模型与优先支持）"],
    ["long English", "Enterprise Global Acceleration Subscription with Priority Support"],
    ["unbroken token", "EnterpriseGlobalAccelerationSubscriptionWithPrioritySupport1234567890"],
  ])("shows the complete %s plan title without clamping", (_label, name) => {
    const wrapper = mountPlanCard("openai", { name });
    const title = wrapper.get("h3");

    expect(title.text()).toBe(name);
    expect(title.attributes("title")).toBe(name);
    expect(title.classes()).toEqual(expect.arrayContaining([
      "min-w-0",
      "break-words",
      "[overflow-wrap:anywhere]",
      "text-lg",
    ]));
    expect(title.classes()).not.toContain("truncate");
    expect(title.classes()).not.toContain("line-clamp-2");
    expect(title.classes()).not.toContain("h-12");
  });

  it("keeps the title and description full-width and all price values on one line container", () => {
    const wrapper = mountPlanCard("openai", {
      name: "Enterprise Global Acceleration Subscription with Priority Support",
      price: 123.45,
      original_price: 200,
      currency: "USD",
      description: "Includes advanced models and priority support.",
    });
    const title = wrapper.get("h3");
    const priceLine = wrapper.get(".plan-card-price-line");

    expect(title.text()).toBe("Enterprise Global Acceleration Subscription with Priority Support");
    expect(wrapper.get("p").text()).toBe("Includes advanced models and priority support.");
    expect(wrapper.html()).not.toContain("line-clamp");
    expect(priceLine.text()).toContain("$123.45USD");
    expect(priceLine.text()).toContain("$200");
    expect(priceLine.text()).toContain("-38%");
    expect(priceLine.get(".plan-card-discount-badge").classes()).toEqual(expect.arrayContaining([
      "bg-fuchsia-50",
      "text-fuchsia-700",
      "ring-fuchsia-200",
    ]));
    expect(priceLine.classes()).toEqual(expect.arrayContaining([
      "flex",
      "flex-wrap",
      "items-baseline",
      "justify-end",
    ]));
    expect(wrapper.get("button").text()).toBe("payment.subscribeNow");
  });

  it("uses a neutral solid card without a colored top accent or gradient", () => {
    const wrapper = mountPlanCard("openai", { name: "Pro", description: "" });
    const root = wrapper.get(".group");

    expect(root.classes()).toEqual(expect.arrayContaining([
      "border-gray-200",
      "bg-white",
      "p-4",
      "h-full",
    ]));
    expect(wrapper.html()).not.toContain("bg-gradient");
    expect(wrapper.html()).not.toContain("h-1.5");
  });

  it("does not render an empty discount when the original price is not higher", () => {
    const wrapper = mountPlanCard("openai", { price: 10, original_price: 10 });

    expect(wrapper.findAll(".line-through")).toHaveLength(0);
    expect(wrapper.get(".plan-card-price-line").text()).not.toContain("-%");
  });

  it("keeps the legacy single-group rate visible", () => {
    const wrapper = mountPlanCard("openai", {
      included_groups: undefined,
      rate_multiplier: 1.5,
      peak_rate_enabled: true,
      peak_rate_multiplier: 2,
    });

    expect(wrapper.text()).toContain("Rate");
    expect(wrapper.text()).toContain("×1.5");
    expect(wrapper.text()).toContain("payment.planCard.peakRateShort");
  });

  it("shows real included-group rates and uses cycle quota as the canonical quota", () => {
    const wrapper = mountPlanCard("openai", {
      included_groups: [
        { id: 10, name: "GPT-1", platform: "openai", rate_multiplier: 0.1 },
        { id: 11, name: "GPT-2", platform: "claude", rate_multiplier: 0.2, peak_rate_enabled: true, peak_rate_multiplier: 0.3 },
      ],
      cycle_quota_usd: 40,
      reset_interval_seconds: 604800,
      weekly_limit_usd: 99,
      monthly_limit_usd: 199,
    });

    expect(wrapper.text()).toContain("GPT-1");
    expect(wrapper.text()).toContain("×0.1");
    expect(wrapper.text()).toContain("GPT-2");
    expect(wrapper.text()).toContain("×0.2");
    expect(wrapper.text()).toContain("$40.00");
    expect(wrapper.text()).not.toContain("$99");
    expect(wrapper.text()).not.toContain("$199");
  });
});
