import { BookingModel } from "@/database/booking.model";
import connectToDatabase from "@/lib/mongodb";
import { revalidateTag } from "next/cache";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

type BookingRequest = {
  eventId?: unknown;
  email?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BookingRequest;

    if (typeof body.eventId !== "string" || !Types.ObjectId.isValid(body.eventId)) {
      return NextResponse.json(
        { message: "A valid event id is required." },
        { status: 400 },
      );
    }

    if (typeof body.email !== "string" || body.email.trim().length === 0) {
      return NextResponse.json(
        { message: "A valid email is required." },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const booking = await BookingModel.create({
      eventId: body.eventId,
      email: body.email,
    });

    revalidateTag(`event-bookings-${body.eventId}`, "max");

    return NextResponse.json(
      { message: "Booking created successfully.", bookingId: booking._id.toString() },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create booking:", error);

    return NextResponse.json(
      { message: "Booking creation failed." },
      { status: 500 },
    );
  }
}
