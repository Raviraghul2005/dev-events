import { BookingModel } from "@/database/booking.model";
import connectToDatabase from "../mongodb";
import { cacheLife, cacheTag } from "next/cache";

export const getBookingCountByEventId = async (eventId: string): Promise<number> => {
  'use cache';
  cacheLife('minutes');
  cacheTag(`event-bookings-${eventId}`);

  try {
    await connectToDatabase();

    return await BookingModel.countDocuments({ eventId }).exec();
  } catch (error) {
    console.error(`Failed to fetch booking count for event "${eventId}":`, error);
    return 0;
  }
};
