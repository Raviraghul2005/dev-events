import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { BookingModel } from "../booking.model";
import * as EventModelModule from "../event.model";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validObjectId = new mongoose.Types.ObjectId();

function validBookingPayload(overrides: Record<string, unknown> = {}) {
  return {
    eventId: validObjectId,
    email: "test@example.com",
    ...overrides,
  };
}

/**
 * Extract the user-defined async pre-save hook function from BookingModel schema.
 * We identify the user hook by its function body to skip internal mongoose plugins.
 */
function getBookingPreSaveHook(): (
  this: Record<string, unknown>,
) => Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hooks = (BookingModel.schema as any).s.hooks._pres.get("save") as
    | Array<{ fn: (this: Record<string, unknown>) => Promise<void> }>
    | undefined;
  // The user hook calls EventModel.exists to verify the referenced event
  const hook = hooks?.find((h) => h.fn.toString().includes("eventExists"));
  if (!hook) {
    throw new Error(
      "User-defined pre-save hook not found on BookingModel schema",
    );
  }
  return hook.fn;
}

// ---------------------------------------------------------------------------
// Schema validation tests (no DB connection required)
// ---------------------------------------------------------------------------

describe("BookingModel – schema validation", () => {
  describe("required fields", () => {
    it("rejects a document missing 'eventId'", async () => {
      const doc = new BookingModel(validBookingPayload({ eventId: undefined }));
      const err = await doc.validate().catch((e) => e);
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors["eventId"]).toBeDefined();
    });

    it("rejects a document missing 'email'", async () => {
      const doc = new BookingModel(validBookingPayload({ email: undefined }));
      const err = await doc.validate().catch((e) => e);
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors["email"]).toBeDefined();
    });
  });

  describe("email validation", () => {
    const validEmails = [
      "user@example.com",
      "user.name@example.com",
      "user+tag@example.co.uk",
      "user123@subdomain.example.org",
      "a@b.c",
    ];

    for (const email of validEmails) {
      it(`accepts valid email: '${email}'`, async () => {
        const doc = new BookingModel(validBookingPayload({ email }));
        await expect(doc.validate()).resolves.toBeUndefined();
      });
    }

    const invalidEmails = [
      "not-an-email",
      "missing-at-sign.com",
      "@nodomain.com",
      "user@",
      "user @example.com",
      "user@ example.com",
      "",
    ];

    for (const email of invalidEmails) {
      it(`rejects invalid email: '${email || "(empty)"}'`, async () => {
        const doc = new BookingModel(validBookingPayload({ email }));
        const err = await doc.validate().catch((e) => e);
        expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
        expect(err.errors["email"]).toBeDefined();
      });
    }

    it("stores email in lowercase", async () => {
      const doc = new BookingModel(
        validBookingPayload({ email: "USER@EXAMPLE.COM" }),
      );
      // After schema processing, the email should be lowercased.
      expect(doc.email).toBe("user@example.com");
    });

    it("trims whitespace from email before validation", async () => {
      // Mongoose 'trim' runs before validation, so leading/trailing spaces are removed.
      const doc = new BookingModel(
        validBookingPayload({ email: "  user@example.com  " }),
      );
      await expect(doc.validate()).resolves.toBeUndefined();
      expect(doc.email).toBe("user@example.com");
    });
  });

  describe("eventId field", () => {
    it("accepts a valid ObjectId for eventId", async () => {
      const doc = new BookingModel(
        validBookingPayload({ eventId: new mongoose.Types.ObjectId() }),
      );
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    it("rejects an invalid ObjectId string", async () => {
      const doc = new BookingModel(
        validBookingPayload({ eventId: "not-an-object-id" }),
      );
      const err = await doc.validate().catch((e) => e);
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors["eventId"]).toBeDefined();
    });
  });

  it("passes validation for a fully valid document", async () => {
    const doc = new BookingModel(validBookingPayload());
    await expect(doc.validate()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Pre-save hook – tested via the extracted hook function with mocked EventModel
// ---------------------------------------------------------------------------

describe("BookingModel – pre-save hook (event existence check)", () => {
  let preSave: (this: Record<string, unknown>) => Promise<void>;

  beforeAll(() => {
    preSave = getBookingPreSaveHook();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proceeds without error when the referenced event exists (new document)", async () => {
    vi.spyOn(EventModelModule.EventModel, "exists").mockResolvedValue({
      _id: validObjectId,
    });

    const ctx: Record<string, unknown> = {
      eventId: validObjectId,
      isNew: true,
      isModified: () => false,
    };

    await expect(preSave.call(ctx)).resolves.toBeUndefined();
    expect(EventModelModule.EventModel.exists).toHaveBeenCalledWith({
      _id: validObjectId,
    });
  });

  it("proceeds without error when eventId is modified and event exists", async () => {
    vi.spyOn(EventModelModule.EventModel, "exists").mockResolvedValue({
      _id: validObjectId,
    });

    const ctx: Record<string, unknown> = {
      eventId: validObjectId,
      isNew: false,
      isModified: (field: unknown) => field === "eventId",
    };

    await expect(preSave.call(ctx)).resolves.toBeUndefined();
  });

  it("throws when the referenced event does not exist", async () => {
    vi.spyOn(EventModelModule.EventModel, "exists").mockResolvedValue(null);

    const ctx: Record<string, unknown> = {
      eventId: validObjectId,
      isNew: true,
      isModified: () => false,
    };

    await expect(preSave.call(ctx)).rejects.toThrow(
      "Referenced event does not exist.",
    );
  });

  it("skips the existence check when document is not new and eventId is not modified", async () => {
    const existsSpy = vi.spyOn(EventModelModule.EventModel, "exists");

    const ctx: Record<string, unknown> = {
      eventId: validObjectId,
      isNew: false,
      isModified: () => false,
    };

    await expect(preSave.call(ctx)).resolves.toBeUndefined();
    expect(existsSpy).not.toHaveBeenCalled();
  });

  it("runs the existence check when isNew is true even if eventId is not marked modified", async () => {
    vi.spyOn(EventModelModule.EventModel, "exists").mockResolvedValue({
      _id: validObjectId,
    });

    const ctx: Record<string, unknown> = {
      eventId: validObjectId,
      isNew: true,
      isModified: () => false,
    };

    await preSave.call(ctx);
    expect(EventModelModule.EventModel.exists).toHaveBeenCalledTimes(1);
  });

  it("clears the promise and rethrows when EventModel.exists rejects", async () => {
    vi.spyOn(EventModelModule.EventModel, "exists").mockRejectedValue(
      new Error("DB error"),
    );

    const ctx: Record<string, unknown> = {
      eventId: validObjectId,
      isNew: true,
      isModified: () => false,
    };

    await expect(preSave.call(ctx)).rejects.toThrow("DB error");
  });
});