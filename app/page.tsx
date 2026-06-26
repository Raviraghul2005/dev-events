import EventCard from "@/components/EventCard"
import ExploreBtn from "@/components/ExploreBtn"
import {Event} from "@/database/event.model"
import { cacheLife } from "next/cache";
import { cacheTag } from "next/cache";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

const getBaseUrl = () => {
  if (!BASE_URL) {
    throw new Error("NEXT_PUBLIC_BASE_URL is required to fetch events.");
  }

  try {
    return new URL(BASE_URL).origin;
  } catch {
    throw new Error("NEXT_PUBLIC_BASE_URL must be a valid absolute URL.");
  }
};

const page = async () => {
  'use cache';
  cacheLife('hours')
  cacheTag('my-data')
  const response = await fetch(`${getBaseUrl()}/api/events`);
  const {events} = await response.json();

  return (
    <section>
      <h1 className="text-center">The Hub for Every Dev <br /> Event You Cant Miss</h1>
      <p className="text-center mt-5">Hackathons, Meetups, and Conferences, All in One Place</p>

      <ExploreBtn/>

      <div className="mt-20 space-y-7">
        <h3>Featured Events</h3>
        <ul className="events">
          {events && events.length>0 && events.map((event: Event)=> (
            <li key={event.slug}>
              <EventCard {...event}/>
            </li>
          ))}
        </ul>
      </div>
    </section>
    

    )
}

export default page
