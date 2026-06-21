import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mongoose } from "mongoose";

// ---------------------------------------------------------------------------
// Mock mongoose.connect before importing the module under test so that tests
// never attempt a real network connection.
// ---------------------------------------------------------------------------

vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mongoose")>();
  return {
    ...actual,
    default: {
      ...actual.default,
      connect: vi.fn(),
    },
  };
});

// Helpers to get a fresh module + mongoose mock between test runs.
async function freshLoad() {
  // Clear the module registry so each test gets a new module instance,
  // which re-evaluates the cached variable.
  vi.resetModules();

  // Also wipe the global cache so the module reinitialises it.
  delete (globalThis as Record<string, unknown>).mongooseCache;

  const mongooseMod = await import("mongoose");
  const { connectToDatabase } = await import("../mongodb");
  return { connectToDatabase, mongooseConnect: mongooseMod.default.connect };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("connectToDatabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as Record<string, unknown>).mongooseCache;
  });

  it("calls mongoose.connect with MONGODB_URI and bufferCommands: false on the first call", async () => {
    const fakeInstance = { connection: {} } as unknown as Mongoose;
    const { connectToDatabase, mongooseConnect } = await freshLoad();
    vi.mocked(mongooseConnect).mockResolvedValueOnce(fakeInstance);

    await connectToDatabase();

    expect(mongooseConnect).toHaveBeenCalledTimes(1);
    expect(mongooseConnect).toHaveBeenCalledWith(
      process.env.MONGODB_URI,
      { bufferCommands: false },
    );
  });

  it("returns the mongoose instance on a successful connection", async () => {
    const fakeInstance = { connection: {} } as unknown as Mongoose;
    const { connectToDatabase, mongooseConnect } = await freshLoad();
    vi.mocked(mongooseConnect).mockResolvedValueOnce(fakeInstance);

    const result = await connectToDatabase();
    expect(result).toBe(fakeInstance);
  });

  it("returns the cached connection without reconnecting on subsequent calls", async () => {
    const fakeInstance = { connection: {} } as unknown as Mongoose;
    const { connectToDatabase, mongooseConnect } = await freshLoad();
    vi.mocked(mongooseConnect).mockResolvedValueOnce(fakeInstance);

    const first = await connectToDatabase();
    const second = await connectToDatabase();

    expect(mongooseConnect).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it("reuses the in-flight promise for concurrent calls (no extra sockets)", async () => {
    const fakeInstance = { connection: {} } as unknown as Mongoose;
    const { connectToDatabase, mongooseConnect } = await freshLoad();

    // Simulate a slow connection.
    vi.mocked(mongooseConnect).mockImplementation(
      () =>
        new Promise<Mongoose>((resolve) =>
          setTimeout(() => resolve(fakeInstance), 10),
        ),
    );

    // Fire two concurrent calls before the first settles.
    const [first, second] = await Promise.all([
      connectToDatabase(),
      connectToDatabase(),
    ]);

    expect(mongooseConnect).toHaveBeenCalledTimes(1);
    expect(first).toBe(fakeInstance);
    expect(second).toBe(fakeInstance);
  });

  it("clears the cached promise when the connection attempt fails", async () => {
    const { connectToDatabase, mongooseConnect } = await freshLoad();
    vi.mocked(mongooseConnect).mockRejectedValueOnce(
      new Error("Connection refused"),
    );

    await expect(connectToDatabase()).rejects.toThrow("Connection refused");

    // The promise should be cleared so a subsequent call retries.
    const fakeInstance = { connection: {} } as unknown as Mongoose;
    vi.mocked(mongooseConnect).mockResolvedValueOnce(fakeInstance);

    const result = await connectToDatabase();
    expect(result).toBe(fakeInstance);
    expect(mongooseConnect).toHaveBeenCalledTimes(2);
  });

  it("rethrows the original error on connection failure", async () => {
    const { connectToDatabase, mongooseConnect } = await freshLoad();
    const originalError = new Error("Network timeout");
    vi.mocked(mongooseConnect).mockRejectedValueOnce(originalError);

    await expect(connectToDatabase()).rejects.toThrow("Network timeout");
  });

  it("persists the connection in globalThis.mongooseCache", async () => {
    const fakeInstance = { connection: {} } as unknown as Mongoose;
    const { connectToDatabase, mongooseConnect } = await freshLoad();
    vi.mocked(mongooseConnect).mockResolvedValueOnce(fakeInstance);

    await connectToDatabase();

    const cache = (globalThis as Record<string, unknown>)
      .mongooseCache as { conn: Mongoose | null; promise: unknown };
    expect(cache).toBeDefined();
    expect(cache.conn).toBe(fakeInstance);
  });

  it("is also accessible via the default export", async () => {
    vi.resetModules();
    delete (globalThis as Record<string, unknown>).mongooseCache;

    const mod = await import("../mongodb");
    expect(mod.default).toBe(mod.connectToDatabase);
  });
});