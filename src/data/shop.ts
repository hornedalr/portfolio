// Shop catalogue. Prices are in Swedish kronor. Checkout is not connected yet.
import type { ImageMetadata } from "astro";
import merinoThrow from "../assets/shop/merino-throw.png";
import feltedStones from "../assets/shop/felted-stones.png";
import handspunYarn from "../assets/shop/handspun-yarn.png";
import wallHanging from "../assets/shop/wall-hanging.png";
import woolCushion from "../assets/shop/wool-cushion.png";
import sheepPostcards from "../assets/shop/sheep-postcards.png";

export interface Product {
  id: string;
  title: string;
  /** Price in whole kronor. */
  price: number;
  detail: string;
  image: ImageMetadata;
  alt: string;
}

export const products: Product[] = [
  { id: "merino-throw", title: "Merino throw", price: 2400, detail: "130 × 170 cm", image: merinoThrow, alt: "Striped cream and pale brown wool throw" },
  { id: "felted-stones", title: "Felted stones, set of 3", price: 450, detail: "Grey, brown, ecru", image: feltedStones, alt: "Three felted wool stones in grey, brown and ecru" },
  { id: "handspun-yarn", title: "Hand-spun yarn", price: 290, detail: "100 g skein", image: handspunYarn, alt: "Loops of cream yarn with a brown strand" },
  { id: "wall-hanging", title: "Wall hanging No. 4", price: 3800, detail: "60 × 90 cm", image: wallHanging, alt: "Woven wall hanging with brown and cream bands and fringe" },
  { id: "wool-cushion", title: "Wool cushion", price: 890, detail: "45 × 45 cm", image: woolCushion, alt: "Square pale brown cushion with a darker border" },
  { id: "sheep-postcards", title: "Sheep postcards", price: 120, detail: "Set of 3", image: sheepPostcards, alt: "Three stacked postcards with a drawn sheep" },
];

export const formatPrice = (kr: number) => `${new Intl.NumberFormat("sv-SE").format(kr)} kr`;