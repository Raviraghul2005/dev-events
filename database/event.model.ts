import { randomUUID } from "crypto";
import { Schema, model, models, type HydratedDocument, type Model } from "mongoose";

export type EventMode = "online" | "offline" | "hybrid";

export interface Event {
  title: string;
  slug: string;
  description: string;
  overview: string;
  image: string;
  venue: string;
  location: string;
  date: string;
  time: string;
  mode: EventMode;
  audience: string;
  agenda: string[];
  organizer: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

type EventDocument = HydratedDocument<Event>;

const isNonEmptyString = (value: string): boolean => value.trim().length > 0;

const requiredString = (field: string) => ({
  type: String,
  required: [true, `${field} is required.`] as [true, string],
  trim: true,
  validate: {
    validator: isNonEmptyString,
    message: `${field} cannot be empty.`,
  },
} as const);

const requiredStringArray = (field: string) => ({
  type: [String],
  required: [true, `${field} is required.`] as [true, string],
  validate: {
    validator: (values: string[]): boolean =>
      values.length > 0 && values.every(isNonEmptyString),
    message: `${field} must include at least one non-empty value.`,
  },
} as const);

const createSlug = (title: string): string => {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `untitled-${randomUUID()}`;
};

const normalizeDate = (value: string): string => {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("Event date must be a valid date.");
  }

  // Store dates as ISO strings so queries and comparisons stay predictable.
  return parsedDate.toISOString();
};

const normalizeTime = (value: string): string => {
  const trimmedValue = value.trim().toUpperCase();
  const twelveHourMatch = trimmedValue.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/);
  const twentyFourHourMatch = trimmedValue.match(/^(\d{1,2}):(\d{2})$/);

  if (twelveHourMatch) {
    const [, rawHour, rawMinute, meridiem] = twelveHourMatch;
    const hour = Number(rawHour);
    const minute = Number(rawMinute);

    if (hour < 1 || hour > 12 || minute > 59) {
      throw new Error("Event time must be a valid time.");
    }

    const normalizedHour =
      meridiem === "PM" && hour !== 12
        ? hour + 12
        : meridiem === "AM" && hour === 12
          ? 0
          : hour;

    return `${normalizedHour.toString().padStart(2, "0")}:${rawMinute}`;
  }

  if (twentyFourHourMatch) {
    const [, rawHour, rawMinute] = twentyFourHourMatch;
    const hour = Number(rawHour);
    const minute = Number(rawMinute);

    if (hour > 23 || minute > 59) {
      throw new Error("Event time must be a valid time.");
    }

    return `${hour.toString().padStart(2, "0")}:${rawMinute}`;
  }

  throw new Error("Event time must use HH:mm or h:mm AM/PM format.");
};

const eventSchema = new Schema<Event>(
  {
    title: requiredString("Title"),
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      validate: {
        validator: isNonEmptyString,
        message: "Slug cannot be empty.",
      },
    },
    description: requiredString("Description"),
    overview: requiredString("Overview"),
    image: requiredString("Image"),
    venue: requiredString("Venue"),
    location: requiredString("Location"),
    date: requiredString("Date"),
    time: requiredString("Time"),
    mode: {
      type: String,
      enum: ["online", "offline", "hybrid"],
      required: [true, "Mode is required."],
    },
    audience: requiredString("Audience"),
    agenda: requiredStringArray("Agenda"),
    organizer: requiredString("Organizer"),
    tags: requiredStringArray("Tags"),
  },
  {
    timestamps: true,
  },
);

eventSchema.index({ slug: 1 }, { unique: true });

eventSchema.pre("save", function (this: EventDocument) {
  // Regenerate slugs only when the title changes to preserve stable URLs.
  if (this.isModified("title")) {
    this.slug = createSlug(this.title);
  }

  // Normalize date and time before persisting for consistent reads.
  if (this.isModified("date")) {
    this.date = normalizeDate(this.date);
  }

  if (this.isModified("time")) {
    this.time = normalizeTime(this.time);
  }
});

export const EventModel: Model<Event> =
  (models.Event as Model<Event> | undefined) ?? model<Event>("Event", eventSchema);
