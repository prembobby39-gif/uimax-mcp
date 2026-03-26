import { describe, it, expect } from "vitest";
import {
  UI_REVIEW_PROMPT,
  RESPONSIVE_REVIEW_PROMPT,
  QUICK_DESIGN_PROMPT,
} from "../prompts/review.js";

describe("review prompts", () => {
  describe("UI_REVIEW_PROMPT", () => {
    it("is a non-empty string", () => {
      expect(typeof UI_REVIEW_PROMPT).toBe("string");
      expect(UI_REVIEW_PROMPT.length).toBeGreaterThan(100);
    });

    it("includes the review framework sections", () => {
      expect(UI_REVIEW_PROMPT).toContain("VISUAL DESIGN & AESTHETICS");
      expect(UI_REVIEW_PROMPT).toContain("USER EXPERIENCE");
      expect(UI_REVIEW_PROMPT).toContain("ACCESSIBILITY");
      expect(UI_REVIEW_PROMPT).toContain("PERFORMANCE");
      expect(UI_REVIEW_PROMPT).toContain("CODE QUALITY");
      expect(UI_REVIEW_PROMPT).toContain("CREATIVE IMPROVEMENTS");
    });

    it("includes severity levels", () => {
      expect(UI_REVIEW_PROMPT).toContain("CRITICAL");
      expect(UI_REVIEW_PROMPT).toContain("HIGH");
      expect(UI_REVIEW_PROMPT).toContain("MEDIUM");
      expect(UI_REVIEW_PROMPT).toContain("LOW");
    });

    it("includes important guidelines", () => {
      expect(UI_REVIEW_PROMPT).toContain("Be specific, not generic");
      expect(UI_REVIEW_PROMPT).toContain("Prioritize ruthlessly");
    });
  });

  describe("RESPONSIVE_REVIEW_PROMPT", () => {
    it("is a non-empty string", () => {
      expect(typeof RESPONSIVE_REVIEW_PROMPT).toBe("string");
      expect(RESPONSIVE_REVIEW_PROMPT.length).toBeGreaterThan(50);
    });

    it("mentions viewport sizes", () => {
      expect(RESPONSIVE_REVIEW_PROMPT).toContain("375px");
      expect(RESPONSIVE_REVIEW_PROMPT).toContain("768px");
      expect(RESPONSIVE_REVIEW_PROMPT).toContain("1440px");
    });

    it("includes responsive review criteria", () => {
      expect(RESPONSIVE_REVIEW_PROMPT).toContain("Layout adaptation");
      expect(RESPONSIVE_REVIEW_PROMPT).toContain("Touch targets");
      expect(RESPONSIVE_REVIEW_PROMPT).toContain("Typography scaling");
    });
  });

  describe("QUICK_DESIGN_PROMPT", () => {
    it("is a non-empty string", () => {
      expect(typeof QUICK_DESIGN_PROMPT).toBe("string");
      expect(QUICK_DESIGN_PROMPT.length).toBeGreaterThan(50);
    });

    it("focuses on design observations", () => {
      expect(QUICK_DESIGN_PROMPT).toContain("visual design");
      expect(QUICK_DESIGN_PROMPT).toContain("Typography");
      expect(QUICK_DESIGN_PROMPT).toContain("Color");
    });
  });
});
