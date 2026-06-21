import { describe, it, expect } from "vitest";

// Verify that the barrel file re-exports the expected identifiers at runtime.
import * as DatabaseIndex from "../index";

describe("database/index – re-exports", () => {
  it("exports EventModel as 'Event'", () => {
    expect(DatabaseIndex.Event).toBeDefined();
    expect(typeof DatabaseIndex.Event).toBe("function");
  });

  it("exports BookingModel as 'Booking'", () => {
    expect(DatabaseIndex.Booking).toBeDefined();
    expect(typeof DatabaseIndex.Booking).toBe("function");
  });

  it("'Event' export is the same reference as EventModel", async () => {
    const { EventModel } = await import("../event.model");
    expect(DatabaseIndex.Event).toBe(EventModel);
  });

  it("'Booking' export is the same reference as BookingModel", async () => {
    const { BookingModel } = await import("../booking.model");
    expect(DatabaseIndex.Booking).toBe(BookingModel);
  });
});