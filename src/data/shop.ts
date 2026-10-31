// Shop catalogue. Prices are in Swedish kronor. Checkout is not connected yet.
import type { ImageMetadata } from "astro";
import lamp1 from "../assets/shop/lamp-1.png";
import lamp2 from "../assets/shop/lamp-2.png";
import lamp3 from "../assets/shop/lamp-3.png";
import lamp4 from "../assets/shop/lamp-4.png";
import lamp5 from "../assets/shop/lamp-5.png";
import lamp6 from "../assets/shop/lamp-6.png";
import original1 from "../assets/shop/original-1.png";
import original2 from "../assets/shop/original-2.png";
import original3 from "../assets/shop/original-3.png";

export interface Product {
  id: string;
  title: string;
  /** Price in whole kronor. */
  price: number;
  detail: string;
  image: ImageMetadata;
  alt: string;
  /** One-of-a-kind pieces can only be bought once. */
  original?: boolean;
  sold?: boolean;
  /** A few sentences for the product's own page. */
  description: string;
  /** More pictures after the main one, e.g. close-ups of the wool. */
  gallery: { image: ImageMetadata; alt: string }[];
}

type Listing = Omit<Product, "description" | "gallery">;

const lampListings: Listing[] = [
  { id: "lamp-1", title: "Lamp 1", price: 2400, detail: "Felted dome pendant · Ø 45 cm", image: lamp1, alt: "Ecru felted dome pendant lamp glowing warmly" },
  { id: "lamp-2", title: "Lamp 2", price: 1900, detail: "Striped wool drum pendant · Ø 30 cm", image: lamp2, alt: "Pale brown drum pendant lamp with darker stripes" },
  { id: "lamp-3", title: "Lamp 3", price: 2100, detail: "Grey felt cone pendant · Ø 50 cm", image: lamp3, alt: "Grey cone-shaped felt pendant lamp" },
  { id: "lamp-4", title: "Lamp 4", price: 3200, detail: "Wool bobble globe · Ø 42 cm", image: lamp4, alt: "Round ecru globe lamp covered in small felted bobbles" },
  { id: "lamp-5", title: "Lamp 5", price: 2800, detail: "Bell pendant, brown trim · Ø 44 cm", image: lamp5, alt: "Bell-shaped pale brown pendant lamp with a dark brown rim" },
  { id: "lamp-6", title: "Lamp 6", price: 3600, detail: "Floor lamp, felted shade · 160 cm", image: lamp6, alt: "Floor lamp with an ecru felted shade on a dark stand" },
];

const originalListings: Listing[] = [
  { id: "original-1", title: "Original 1", price: 12000, detail: "Wool on linen · 60 × 80 cm", image: original1, alt: "Framed wool piece with a brown circle on ecru", original: true },
  { id: "original-2", title: "Original 2", price: 9500, detail: "Woven wool · 50 × 75 cm", image: original2, alt: "Woven piece with horizontal bands of cream, grey and brown", original: true },
  { id: "original-3", title: "Original 3", price: 14500, detail: "Needle-felted wool · 70 × 90 cm", image: original3, alt: "Felted landscape with grey hills and a pale brown sun", original: true, sold: true },
];

const descriptions: Record<string, string> = {
  "lamp-1": "A wide dome of hand-felted ecru wool. The felt is thick enough to soften the bulb into an even, warm glow, and thin enough at the edge to let a brighter ring of light through.",
  "lamp-2": "A drum of pale brown wool with darker stripes laid in during felting, so the stripes are part of the shade rather than painted on. Lit, the stripes show up as soft bands of shadow.",
  "lamp-3": "A tall cone of grey felt that sends most of its light straight down, good above a dining table. The outside keeps the slightly uneven surface of wool felted by hand.",
  "lamp-4": "A globe covered in small felted bobbles, each one rolled by hand. When it is on, every bobble catches the light differently and the whole lamp looks like a soft cloud.",
  "lamp-5": "A bell-shaped pendant in pale brown wool, finished with a darker brown rim. The rim keeps the opening crisp and frames the light falling below it.",
  "lamp-6": "A floor lamp with a felted ecru shade on a dark stand. The shade sits at reading height and gives a calm, diffused light to a corner or next to a chair.",
  "original-1": "A brown wool circle worked into ecru linen. The wool sits slightly raised from the linen, so the piece changes with the light in the room through the day.",
  "original-2": "Bands of cream, grey and brown wool woven on the loom. The colours are undyed wool from different sheep, so every band has its own natural tone.",
  "original-3": "A felted landscape: grey hills under a pale brown sun, built up layer by layer with a felting needle until the colours blend into each other.",
};

const details = import.meta.glob<{ default: ImageMetadata }>("../assets/shop/*-detail-*.png", { eager: true });
const closeUps = (id: string, title: string) =>
  [1, 2].map((n) => ({
    image: details[`../assets/shop/${id}-detail-${n}.png`].default,
    alt: n === 1 ? `${title}, closer` : `${title}, close-up of the wool`,
  }));

const withPage = (listing: Listing): Product => ({
  ...listing,
  description: descriptions[listing.id],
  gallery: closeUps(listing.id, listing.title),
});

export const lamps = lampListings.map(withPage);
export const originals = originalListings.map(withPage);
export const products = [...lamps, ...originals];

export const productHref = (product: Product) => `/shop/${product.id}/`;

export const formatPrice = (kr: number) => `${new Intl.NumberFormat("sv-SE").format(kr)} kr`;