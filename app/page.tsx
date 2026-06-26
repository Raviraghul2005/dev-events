import EventCard from "@/components/EventCard"
import ExploreBtn from "@/components/ExploreBtn"
import { getEvents, type EventCardData } from "@/lib/actions/event.actions";
import { cacheLife } from "next/cache";
import { cacheTag } from "next/cache";

const page = async () => {
  'use cache';
  cacheLife('hours')
  cacheTag('my-data')
  const events = await getEvents();

  return (
    <section>
      <h1 className="text-center">The Hub for Every Dev <br /> Event You Cant Miss</h1>
      <p className="text-center mt-5">Hackathons, Meetups, and Conferences, All in One Place</p>

      <ExploreBtn/>

      <div className="mt-20 space-y-7">
        <h3>Featured Events</h3>
        <ul className="events">
          {events.length > 0 && events.map((event: EventCardData)=> (
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
