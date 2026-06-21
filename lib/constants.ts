export type Event = {
  title: string;
  image: string;
  slug: string;
  location: string;
  date: string;
  time: string;
};

export const events: Event[] = [
  {
    title: "KubeCon + CloudNativeCon North America 2026",
    image: "/images/event1.png",
    slug: "kubecon-cloudnativecon-north-america-2026",
    location: "Salt Lake City, Utah",
    date: "November 9-12, 2026",
    time: "9:00 AM MST",
  },
  {
    title: "GitHub Universe 2026",
    image: "/images/event2.png",
    slug: "github-universe-2026",
    location: "San Francisco, California",
    date: "October 28-29, 2026",
    time: "9:30 AM PDT",
  },
  {
    title: "React Conf 2025",
    image: "/images/event3.png",
    slug: "react-conf-2025",
    location: "Henderson, Nevada",
    date: "October 7-8, 2025",
    time: "10:00 AM PDT",
  },
  {
    title: "NASA Space Apps Challenge 2026",
    image: "/images/event4.png",
    slug: "nasa-space-apps-challenge-2026",
    location: "Global and virtual",
    date: "October 2026",
    time: "Local event time",
  },
  {
    title: "PyCon US 2026",
    image: "/images/event5.png",
    slug: "pycon-us-2026",
    location: "Long Beach, California",
    date: "May 13-19, 2026",
    time: "8:30 AM PDT",
  },
  {
    title: "Open Source Summit North America 2027",
    image: "/images/event6.png",
    slug: "open-source-summit-north-america-2027",
    location: "Vancouver, British Columbia",
    date: "May 17-19, 2027",
    time: "9:00 AM PDT",
  },
];
