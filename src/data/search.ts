// Everything the site search can find, built at compile time and shipped as a small JSON blob.
import { profile, projects, slug } from "./site";
import { formatPrice, lamps, originals, productHref } from "./shop";
import { exhibitionId, exhibitions, formatDates } from "./exhibitions";

export interface SearchEntry {
  title: string;
  kind: string;
  /** Shown under the title. */
  text: string;
  /** Extra words that match but aren't shown. */
  keywords?: string;
  href: string;
}

export const searchIndex: SearchEntry[] = [
  { title: "Selected works", kind: "Section", text: "Projects and pieces", keywords: "portfolio", href: "/#work" },
  { title: "Exhibitions", kind: "Section", text: "Past and upcoming shows", keywords: "events gallery", href: "/#exhibitions" },
  { title: "Shop", kind: "Section", text: "Lamps and original works", keywords: "buy store", href: "/shop/" },
  { title: "Lamps", kind: "Shop", text: "Pendant and floor lamps", keywords: "lamp light", href: "/shop/#shop-lamps" },
  { title: "Original works", kind: "Shop", text: "One-of-a-kind pieces", keywords: "original art", href: "/shop/#shop-originals" },
  { title: "About me", kind: "Section", text: profile.bio.join(" "), href: "/#about" },
  { title: "Contact", kind: "Section", text: `${profile.email} · @${profile.instagram.handle}`, keywords: "email instagram", href: "/#contact" },
  ...projects.map((p) => ({
    title: p.title,
    kind: "Work",
    text: [...p.details.map((d) => d.value), p.summary].join(" · "),
    href: `/#work-${slug(p.title)}`,
  })),
  ...lamps.map((p) => ({ title: p.title, kind: "Lamp", text: `${p.detail} · ${formatPrice(p.price)}`, href: productHref(p) })),
  ...originals.map((p) => ({
    title: p.title,
    kind: "Original work",
    text: `${p.detail} · ${p.sold ? "Sold" : formatPrice(p.price)}`,
    href: productHref(p),
  })),
  ...exhibitions.map((x) => ({ title: x.title, kind: "Exhibition", text: `${x.venue} · ${formatDates(x)}`, href: `/#${exhibitionId(x)}` })),
];