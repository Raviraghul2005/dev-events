import { describe, it, expect, beforeAll } from "vitest";
import mongoose from "mongoose";
import { EventModel } from "../event.model";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a complete, valid Event payload so individual tests can override
 * only the field they care about.
 */
function validEventPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Test Conference 2024",
    description: "A great conference for developers",
    overview: "Overview of the test conference",
    image: "/images/test.png",
    venue: "Test Venue Hall",
    location: "San Francisco, CA",
    date: "2024-06-15",
    time: "09:00",
    mode: "online" as const,
    audience: "Developers",
    agenda: ["Opening keynote", "Workshop"],
    organizer: "Test Org",
    tags: ["tech", "conference"],
    ...overrides,
  };
}

/**
 * Extract the user-defined pre-save hook function from the EventModel schema.
 * Mongoose 9.x stores hooks via the Kareem library under schema.s.hooks.
 * We identify the user hook by its function body to skip internal mongoose plugins.
 */
function getEventPreSaveHook(): (this: Record<string, unknown>) => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hooks = (EventModel.schema as any).s.hooks._pres.get("save") as
    | Array<{ fn: (this: Record<string, unknown>) => void }>
    | undefined;
  // The user hook calls isModified and sets this.slug / this.date / this.time
  const hook = hooks?.find((h) => h.fn.toString().includes("isModified"));
  if (!hook) {
    throw new Error("User-defined pre-save hook not found on EventModel schema");
  }
  return hook.fn;
}

// ---------------------------------------------------------------------------
// Schema validation tests (no DB connection required)
// ---------------------------------------------------------------------------

describe("EventModel – schema validation", () => {
  describe("required fields", () => {
    const requiredFields = [
      "title",
      "description",
      "overview",
      "image",
      "venue",
      "location",
      "date",
      "time",
      "mode",
      "audience",
      "organizer",
    ] as const;

    for (const field of requiredFields) {
      it(`rejects a document missing '${field}'`, async () => {
        const payload = validEventPayload({ [field]: undefined });
        const doc = new EventModel(payload);
        const err = await doc.validate().catch((e) => e);
        expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
        expect(err.errors[field]).toBeDefined();
      });
    }

    it("rejects a document missing 'agenda'", async () => {
      const doc = new EventModel(validEventPayload({ agenda: undefined }));
      const err = await doc.validate().catch((e) => e);
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors["agenda"]).toBeDefined();
    });

    it("rejects a document missing 'tags'", async () => {
      const doc = new EventModel(validEventPayload({ tags: undefined }));
      const err = await doc.validate().catch((e) => e);
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors["tags"]).toBeDefined();
    });
  });

  describe("string fields cannot be whitespace-only", () => {
    const stringFields = [
      "title",
      "description",
      "overview",
      "image",
      "venue",
      "location",
      "date",
      "time",
      "audience",
      "organizer",
    ] as const;

    for (const field of stringFields) {
      it(`rejects '${field}' that is only whitespace`, async () => {
        const doc = new EventModel(validEventPayload({ [field]: "   " }));
        const err = await doc.validate().catch((e) => e);
        expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
        expect(err.errors[field]).toBeDefined();
      });
    }
  });

  describe("mode enum", () => {
    it("accepts 'online'", async () => {
      const doc = new EventModel(validEventPayload({ mode: "online" }));
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    it("accepts 'offline'", async () => {
      const doc = new EventModel(validEventPayload({ mode: "offline" }));
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    it("accepts 'hybrid'", async () => {
      const doc = new EventModel(validEventPayload({ mode: "hybrid" }));
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    it("rejects an unknown mode value", async () => {
      const doc = new EventModel(validEventPayload({ mode: "virtual" }));
      const err = await doc.validate().catch((e) => e);
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors["mode"]).toBeDefined();
    });
  });

  describe("agenda and tags array validation", () => {
    it("rejects an empty agenda array", async () => {
      const doc = new EventModel(validEventPayload({ agenda: [] }));
      const err = await doc.validate().catch((e) => e);
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors["agenda"]).toBeDefined();
    });

    it("rejects agenda containing a whitespace-only string", async () => {
      const doc = new EventModel(
        validEventPayload({ agenda: ["Valid item", "   "] }),
      );
      const err = await doc.validate().catch((e) => e);
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors["agenda"]).toBeDefined();
    });

    it("rejects an empty tags array", async () => {
      const doc = new EventModel(validEventPayload({ tags: [] }));
      const err = await doc.validate().catch((e) => e);
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors["tags"]).toBeDefined();
    });

    it("rejects tags containing a whitespace-only string", async () => {
      const doc = new EventModel(
        validEventPayload({ tags: ["tech", "   "] }),
      );
      const err = await doc.validate().catch((e) => e);
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors["tags"]).toBeDefined();
    });

    it("accepts agenda with multiple non-empty strings", async () => {
      const doc = new EventModel(
        validEventPayload({ agenda: ["Keynote", "Break", "Workshop"] }),
      );
      await expect(doc.validate()).resolves.toBeUndefined();
    });
  });

  it("passes validation for a fully valid document", async () => {
    const doc = new EventModel(validEventPayload());
    await expect(doc.validate()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createSlug – tested via the pre-save hook with a mock document context
// ---------------------------------------------------------------------------

describe("createSlug (via pre-save hook)", () => {
  let preSave: (this: Record<string, unknown>) => void;

  beforeAll(() => {
    preSave = getEventPreSaveHook();
  });

  function runHook(title: string) {
    const ctx: Record<string, unknown> = {
      slug: "",
      title,
      date: "2024-01-01",
      time: "09:00",
      isModified: (field: string) => field === "title",
    };
    preSave.call(ctx);
    return ctx.slug as string;
  }

  it("lowercases the title", () => {
    expect(runHook("Hello World")).toBe("hello-world");
  });

  it("replaces spaces with hyphens", () => {
    expect(runHook("My Cool Event")).toBe("my-cool-event");
  });

  it("replaces consecutive special characters with a single hyphen", () => {
    expect(runHook("Hello!!! World")).toBe("hello-world");
  });

  it("trims leading and trailing whitespace from the title", () => {
    expect(runHook("  Hello World  ")).toBe("hello-world");
  });

  it("strips leading and trailing hyphens from the slug", () => {
    expect(runHook("---Hello World---")).toBe("hello-world");
  });

  it("preserves digits in the slug", () => {
    expect(runHook("Event 2024")).toBe("event-2024");
  });

  it("collapses multiple hyphens to one", () => {
    expect(runHook("Hello   ---   World")).toBe("hello-world");
  });

  it("returns 'untitled-<uuid>' when slug would be empty after processing", () => {
    const slug = runHook("!!!");
    expect(slug).toMatch(/^untitled-[0-9a-f-]{36}$/);
  });

  it("does NOT update the slug when title is not modified", () => {
    const ctx: Record<string, unknown> = {
      slug: "existing-slug",
      title: "New Title",
      date: "2024-01-01",
      time: "09:00",
      isModified: () => false,
    };
    preSave.call(ctx);
    expect(ctx.slug).toBe("existing-slug");
  });
});

// ---------------------------------------------------------------------------
// normalizeDate – tested via the pre-save hook
// ---------------------------------------------------------------------------

describe("normalizeDate (via pre-save hook)", () => {
  let preSave: (this: Record<string, unknown>) => void;

  beforeAll(() => {
    preSave = getEventPreSaveHook();
  });

  function runHook(date: string) {
    const ctx: Record<string, unknown> = {
      slug: "slug",
      title: "Title",
      date,
      time: "09:00",
      isModified: (field: string) => field === "date",
    };
    preSave.call(ctx);
    return ctx.date as string;
  }

  it("converts a YYYY-MM-DD date string to an ISO 8601 string", () => {
    const result = runHook("2024-06-15");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    expect(new Date(result).toISOString()).toBe(result);
  });

  it("preserves an already-valid ISO string", () => {
    const iso = "2024-06-15T00:00:00.000Z";
    const result = runHook(iso);
    expect(result).toBe(iso);
  });

  it("throws for an invalid date string", () => {
    const ctx: Record<string, unknown> = {
      slug: "slug",
      title: "Title",
      date: "not-a-date",
      time: "09:00",
      isModified: (field: string) => field === "date",
    };
    expect(() => preSave.call(ctx)).toThrow("Event date must be a valid date.");
  });

  it("throws for an empty date string", () => {
    const ctx: Record<string, unknown> = {
      slug: "slug",
      title: "Title",
      date: "",
      time: "09:00",
      isModified: (field: string) => field === "date",
    };
    expect(() => preSave.call(ctx)).toThrow("Event date must be a valid date.");
  });

  it("does NOT modify date when date is not modified", () => {
    const ctx: Record<string, unknown> = {
      slug: "slug",
      title: "Title",
      date: "original-value",
      time: "09:00",
      isModified: () => false,
    };
    preSave.call(ctx);
    expect(ctx.date).toBe("original-value");
  });
});

// ---------------------------------------------------------------------------
// normalizeTime – tested via the pre-save hook
// ---------------------------------------------------------------------------

describe("normalizeTime (via pre-save hook)", () => {
  let preSave: (this: Record<string, unknown>) => void;

  beforeAll(() => {
    preSave = getEventPreSaveHook();
  });

  function runHook(time: string): string {
    const ctx: Record<string, unknown> = {
      slug: "slug",
      title: "Title",
      date: "2024-06-15",
      time,
      isModified: (field: string) => field === "time",
    };
    preSave.call(ctx);
    return ctx.time as string;
  }

  function expectThrow(time: string, message: string) {
    const ctx: Record<string, unknown> = {
      slug: "slug",
      title: "Title",
      date: "2024-06-15",
      time,
      isModified: (field: string) => field === "time",
    };
    expect(() => preSave.call(ctx)).toThrow(message);
  }

  // 12-hour format
  it("normalizes '9:00 AM' to '09:00'", () => {
    expect(runHook("9:00 AM")).toBe("09:00");
  });

  it("normalizes '12:00 PM' to '12:00'", () => {
    expect(runHook("12:00 PM")).toBe("12:00");
  });

  it("normalizes '12:00 AM' (midnight) to '00:00'", () => {
    expect(runHook("12:00 AM")).toBe("00:00");
  });

  it("normalizes '1:30 PM' to '13:30'", () => {
    expect(runHook("1:30 PM")).toBe("13:30");
  });

  it("normalizes '11:59 PM' to '23:59'", () => {
    expect(runHook("11:59 PM")).toBe("23:59");
  });

  it("handles lowercase 'am' / 'pm' in 12-hour format", () => {
    expect(runHook("9:00 am")).toBe("09:00");
    expect(runHook("1:00 pm")).toBe("13:00");
  });

  it("normalizes '12:30 AM' to '00:30'", () => {
    expect(runHook("12:30 AM")).toBe("00:30");
  });

  // 24-hour format
  it("normalizes '13:30' to '13:30'", () => {
    expect(runHook("13:30")).toBe("13:30");
  });

  it("normalizes '9:00' (single-digit hour) to '09:00'", () => {
    expect(runHook("9:00")).toBe("09:00");
  });

  it("normalizes '00:00' to '00:00'", () => {
    expect(runHook("00:00")).toBe("00:00");
  });

  it("normalizes '23:59' to '23:59'", () => {
    expect(runHook("23:59")).toBe("23:59");
  });

  // Invalid cases
  it("throws for 12-hour format with hour 0 ('0:00 AM')", () => {
    expectThrow("0:00 AM", "Event time must be a valid time.");
  });

  it("throws for 12-hour format with hour > 12", () => {
    expectThrow("13:00 PM", "Event time must be a valid time.");
  });

  it("throws for 12-hour format with minute > 59", () => {
    expectThrow("1:60 AM", "Event time must be a valid time.");
  });

  it("throws for 24-hour format with hour > 23", () => {
    expectThrow("24:00", "Event time must be a valid time.");
  });

  it("throws for 24-hour format with minute > 59", () => {
    expectThrow("12:60", "Event time must be a valid time.");
  });

  it("throws for a completely invalid time string", () => {
    expectThrow("noon", "Event time must use HH:mm or h:mm AM/PM format.");
  });

  it("throws for an empty time string", () => {
    expectThrow("", "Event time must use HH:mm or h:mm AM/PM format.");
  });

  it("does NOT modify time when time is not modified", () => {
    const ctx: Record<string, unknown> = {
      slug: "slug",
      title: "Title",
      date: "2024-06-15",
      time: "original-value",
      isModified: () => false,
    };
    preSave.call(ctx);
    expect(ctx.time).toBe("original-value");
  });
});