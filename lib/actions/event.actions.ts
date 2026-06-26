import { EventModel, type Event } from "@/database/event.model";
import connectToDatabase from "../mongodb";
import { cacheLife, cacheTag } from "next/cache";
import type { Types } from "mongoose";

export type EventCardData = Pick<Event, "title" | "image" | "slug" | "location" | "date" | "time">;
export type EventDetailsData = Omit<Event, "createdAt" | "updatedAt"> & {
    _id: string;
    createdAt: string;
    updatedAt: string;
    __v?: number;
};

type EventDetailsDocument = Event & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
    __v?: number;
};

const serializeEvent = (event: EventDetailsDocument): EventDetailsData => ({
    ...event,
    _id: event._id.toString(),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
});

export const getEvents = async(): Promise<EventCardData[]> => {
    'use cache';
    cacheLife('hours');
    cacheTag('events');

    try {
        await connectToDatabase();

        return await EventModel.find()
            .sort({ createdAt: -1 })
            .select("-_id title image slug location date time")
            .lean<EventCardData[]>()
            .exec();
    } catch (e) {
        console.error("Failed to fetch events:", e);
        return [];
    }
}

export const getEventSlugs = async(): Promise<string[]> => {
    'use cache';
    cacheLife('hours');
    cacheTag('events');

    try {
        await connectToDatabase();

        const events = await EventModel.find()
            .select("-_id slug")
            .lean<Pick<Event, "slug">[]>()
            .exec();

        return events.map((event) => event.slug);
    } catch (e) {
        console.error("Failed to fetch event slugs:", e);
        return [];
    }
}

export const getEventBySlug = async(slug: string): Promise<EventDetailsData | null> => {
    'use cache';
    cacheLife('hours');
    cacheTag('events');

    try {
        await connectToDatabase();

        const event = await EventModel.findOne({ slug })
            .lean<EventDetailsDocument>()
            .exec();

        return event ? serializeEvent(event) : null;
    } catch (e) {
        console.error(`Failed to fetch event by slug "${slug}":`, e);
        return null;
    }
}

export const getSimilarEventsBySlug = async(slug:string): Promise<EventCardData[]> => {
    'use cache';
    cacheLife('hours');
    cacheTag('events');

    try{
        await connectToDatabase();

        const event = await EventModel.findOne({slug})
            .select("_id tags")
            .lean<{ _id: Types.ObjectId; tags?: string[] }>()
            .exec();

        if (!event) {
            return [];
        }

        if (!event.tags?.length) {
            return [];
        }

        return await EventModel.find({
            _id: { $ne: event._id },
            tags: { $in: event.tags },
            })
            .select("-_id title image slug location date time")
            .lean<EventCardData[]>()
            .exec();

        
    } catch(e){
        console.error(`Failed to fetch similar events for slug "${slug}":`, e);
        return [];
    }
}
