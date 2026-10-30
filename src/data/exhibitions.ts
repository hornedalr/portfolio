import { slug } from "./site";

// Exhibitions, newest first. An exhibition counts as past once its end date has gone by.
export interface Exhibition {
  title: string;
  venue: string;
  /** ISO dates (YYYY-MM-DD). */
  start: string;
  end: string;
  href: string;
}

export const exhibitions: Exhibition[] = [
  { title: "Exhibition 5", venue: "Galleri Ull, Stockholm", start: "2027-03-06", end: "2027-04-11", href: "https://example.com/" },
  { title: "Exhibition 4", venue: "Form/Design Center, Malmö", start: "2026-11-14", end: "2027-01-10", href: "https://example.com/" },
  { title: "Exhibition 3", venue: "Konsthantverkarna, Stockholm", start: "2026-05-02", end: "2026-06-07", href: "https://example.com/" },
  { title: "Exhibition 2", venue: "Röhsska museet, Gothenburg", start: "2025-09-12", end: "2025-11-02", href: "https://example.com/" },
  { title: "Exhibition 1", venue: "Uppsala Konstmuseum, Uppsala", start: "2025-03-08", end: "2025-04-13", href: "https://example.com/" },
];

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const dayYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "14 Nov 2026 – 10 Jan 2027", or "2 May – 7 Jun 2026" within one year. */
export const formatDates = ({ start, end }: Exhibition) => {
  const s = new Date(start), e = new Date(end);
  const first = s.getUTCFullYear() === e.getUTCFullYear() ? day.format(s) : dayYear.format(s);
  return `${first} – ${dayYear.format(e)}`;
};

export const exhibitionId = (x: Exhibition) => `exhibition-${slug(x.title)}`;