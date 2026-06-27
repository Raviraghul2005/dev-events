import { notFound } from "next/navigation";
import Image from "next/image";
import BookEvent from "@/components/BookEvent";
import { getEventBySlug, getEventSlugs, getSimilarEventsBySlug, type EventCardData } from "@/lib/actions/event.actions";
import EventCard from "@/components/EventCard";
import { formatEventDate } from "@/lib/utils";
import { cacheLife } from "next/cache";
import { getBookingCountByEventId } from "@/lib/actions/booking.actions";
import type { Metadata } from "next";

type EventPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) {
    return {
      title: "Event not found",
    };
  }

  const eventUrl = `/events/${event.slug}`;

  return {
    title: event.title,
    description: event.description,
    alternates: {
      canonical: eventUrl,
    },
    openGraph: {
      type: "website",
      title: event.title,
      description: event.description,
      url: eventUrl,
      images: [
        {
          url: event.image,
          alt: `${event.title} event banner`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description: event.description,
      images: [event.image],
    },
  };
}

export const generateStaticParams = async () => {
  const slugs = await getEventSlugs();

  return slugs.length > 0
    ? slugs.map((slug) => ({ slug }))
    : [{ slug: "__placeholder__" }];
};

const normalizeStringArray = (value: unknown): string[] => {
  const normalize = (items: unknown[]) =>
    items.filter((item): item is string => typeof item === "string" && item.trim().length > 0);

  if (Array.isArray(value)) {
    if (value.length === 1 && typeof value[0] === "string") {
      try {
        const parsed = JSON.parse(value[0]);
        if (Array.isArray(parsed)) return normalize(parsed);
      } catch {
        return normalize(value);
      }
    }

    return normalize(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return normalize(parsed);
    } catch {
      return [value];
    }

    return [value];
  }

  return [];
}

const EventDetailItem = ({icon, alt, label}: {icon:string; alt:string; label:string}) =>(
  <div className="flex-row-gap-2 items-center">
    <Image src={icon} alt={alt} width={17} height={17}/>
    <p>{label}</p>
  </div>
)

const EventAgenda = ({agendaItems}: {agendaItems: string[]})=>(
  <div className="agenda">
    <h2>
      Agenda
    </h2>

    <ul>
      {agendaItems.map((item)=>(
        <li key={item}>{item}</li>
      ))}
    </ul>
  </div>
)

const EventTags = ({tags}:{tags: string[] })=>(
  <div className="flex flex-row gap-1.5 flex-wrap">
    {tags.map((tag)=>(
      <div className="pill" key={tag}>{tag}</div>
    ))}
  </div>
)



const EventDetailsPage = async ({params}: EventPageProps) => {
  'use cache'
  cacheLife('hours')
  
  const {slug} = await params;
  const event = await getEventBySlug(slug);

  if(!event?.description) notFound();

  const {description, image, overview, date, time ,location, mode, agenda, audience, tags, organizer} = event;
  const agendaItems = normalizeStringArray(agenda);
  const eventTags = normalizeStringArray(tags);

  const [bookings, similarEvents] = await Promise.all([
    getBookingCountByEventId(event._id),
    getSimilarEventsBySlug(slug),
  ]);
  
  return (
    <section id="event">
      <div className="header">
        <h1>Event Description</h1>
        <p className="mt-2">{description}</p>
      </div>

      <div className="details">
        {/* Left side - Event Content*/}
        <div className="content">
          <Image src={image} alt="Event Banner" width={800} height={800} className="banner"/>

          <section className="flex-col-gap-2">
            <h2>Overview</h2>
            <p>{overview}</p>
          </section>

          <section className="flex-col-gap-2">
            <h2>Event Details</h2>
            <EventDetailItem icon="/icons/calendar.svg" alt="calendar" label={formatEventDate(date)}/>
            <EventDetailItem icon="/icons/clock.svg" alt="clock" label={time}/>
            <EventDetailItem icon="/icons/pin.svg" alt="pin" label={location}/>
            <EventDetailItem icon="/icons/mode.svg" alt="mode" label={mode}/>
            <EventDetailItem icon="/icons/audience.svg" alt="audience" label={audience}/>
          </section>

          <EventAgenda agendaItems={agendaItems}/>

          <section className="flex-col-gap-2">
            <h2>About the Organizer</h2>
            <p>{organizer}</p>
          </section>

          <EventTags tags={eventTags}/>
        </div>
        

        {/* Right side - Booking Form */}
        <aside className="booking">
          <div className="signup-card">
            <h2>Book Your Spot</h2>
            {bookings > 0 ? (
              <p className="text-sm">
                Join {bookings} people who have already booked their spot! 
              </p>
            ): (
              <p className="text-sm"> Be the First to book your spot!</p>
            )}

            <BookEvent eventId={event._id} slug={event.slug}/>
          </div>
        </aside>
      </div>

      <div className="flex w-full flex-col gap-4 pt-20">
        <h2>Similar Events </h2>
        <div className="events">
          {similarEvents.length > 0 && similarEvents.map((similarEvent: EventCardData) => (
          <EventCard
            key={similarEvent.slug}
            title={similarEvent.title}
            image={similarEvent.image}
            slug={similarEvent.slug}
            location={similarEvent.location}
            date={similarEvent.date}
            time={similarEvent.time}
          />
          ))}
        </div>
      </div>
    </section>
  )
}

export default EventDetailsPage
