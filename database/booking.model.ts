import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
  type Types,
} from "mongoose";
import { EventModel } from "./event.model";

export interface Booking {
  eventId: Types.ObjectId;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

type BookingDocument = HydratedDocument<Booking>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const bookingSchema = new Schema<Booking>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event is required."],
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      trim: true,
      lowercase: true,
      validate: {
        validator: (value: string): boolean => emailPattern.test(value),
        message: "Email must be a valid email address.",
      },
    },
  },
  {
    timestamps: true,
  },
);

bookingSchema.index({ eventId: 1 });

bookingSchema.pre("save", async function (this: BookingDocument) {
  // Confirm the reference exists before creating a booking.
  if (this.isModified("eventId") || this.isNew) {
    const eventExists = await EventModel.exists({ _id: this.eventId });

    if (!eventExists) {
      throw new Error("Referenced event does not exist.");
    }
  }
});

export const BookingModel: Model<Booking> =
  (models.Booking as Model<Booking> | undefined) ??
  model<Booking>("Booking", bookingSchema);
