import { EventModel, type Event } from "@/database/event.model";
import connectToDatabase from "@/lib/mongodb";
import { Error as MongooseError } from "mongoose";
import { NextResponse } from "next/server";

type EventRouteContext = {
  params: Promise<{
    slug?: string;
  }>;
};

type ErrorResponse = {
  message: string;
  error?: string;
};

type EventResponse = {
  message: string;
  event: Event;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const jsonError = (message: string, status: number, error?: string) =>
  NextResponse.json<ErrorResponse>(
    { message, ...(error ? { error } : {}) },
    { status },
  );

const normalizeSlug = (slug: string | undefined): string | null => {
  const normalizedSlug = slug?.trim().toLowerCase();

  if (!normalizedSlug || !SLUG_PATTERN.test(normalizedSlug)) {
    return null;
  }

  return normalizedSlug;
};

export async function GET(
  _request: Request,
  context: EventRouteContext,
): Promise<NextResponse<EventResponse | ErrorResponse>> {
  try {
    const { slug: rawSlug } = await context.params;
    const slug = normalizeSlug(rawSlug);

    if (!slug) {
      return jsonError(
        "A valid event slug is required. Use lowercase letters, numbers, and hyphens only.",
        400,
      );
    }

    await connectToDatabase();

    // Use lean reads for a lightweight, serialization-friendly response.
    const event = await EventModel.findOne({ slug }).lean<Event>().exec();

    if (!event) {
      return jsonError("Event not found.", 404);
    }

    return NextResponse.json<EventResponse>(
      { message: "Event fetched successfully.", event },
      { status: 200 },
    );
  } catch (error: unknown) {
    if (error instanceof MongooseError.ValidationError) {
      return jsonError("Invalid event query.", 400, error.message);
    }

    console.error("Failed to fetch event by slug:", error);

    return jsonError("Failed to fetch event.", 500);
  }
}
