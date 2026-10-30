import type { ImageMetadata } from "astro";
import tamedWool from "../assets/projects/tamed-wool.jpg";
import naraGrannar from "../assets/projects/nara-grannar.jpg";
import goodWool from "../assets/projects/good-wool-collective.jpg";
import skymningCeiling from "../assets/projects/skymning-ceiling.jpg";
import skymningTable from "../assets/projects/skymning-table.jpg";
import skymningVarme from "../assets/projects/skymning-varme.jpg";
import varme from "../assets/projects/varme.jpg";
import portrait from "../assets/portrait.png";

export const profile = {
  name: "Lara Braun",
  role: "Frontend & Creative Developer",
  location: "Stockholm, Sweden",
  tagline: "I build fast, accessible interfaces that feel effortless to use.",
  bio: [
    "I'm a developer with a background in design, focused on turning complex problems into simple, delightful web experiences.",
    "I care about performance budgets, semantic HTML and inclusive design. When I'm not shipping UI, I'm prototyping small games or photographing city architecture.",
  ],
  portrait,
  portraitAlt: "Portrait of Lara Braun",
  email: "larabr01@hotmail.com",
  instagram: { handle: "lara.a.braun", href: "https://www.instagram.com/lara.a.braun/" },
};

export interface Project {
  title: string;
  summary: string;
  image: ImageMetadata;
  alt: string;
  /** Small facts shown under the title, e.g. date, duration, dimensions. */
  details: { label: string; value: string }[];
  href?: string;
}

export const projects: Project[] = [
  {
    title: "Tamed Wool",
    summary:
      "My degree project at Konstfack, and the ROSLAGEN collection. How can Swedish wool take more space in the lighting industry? I shaped wool at a large scale without blending it with polyester-based binders, taming it until the material could start to carry itself.",
    image: tamedWool,
    details: [
      { label: "Date", value: "May 2026" },
      { label: "Duration", value: "2 months" },
      { label: "Exhibited", value: "Konstfack Spring Exhibition" },
    ],
    alt: "Round wall lamp: a glowing disc of pale wool set in a dark circular backplate on a dark wall",
  },
  {
    title: "nära Grannar",
    summary:
      "A spatial light object in wool and clay. The wool floats and only comes alive with light; the clay carries and positions the light source. Each material depends on the other. The wool comes from endangered Swedish landrace sheep: Värmland, Hälsinge and Gestrike.",
    image: naraGrannar,
    details: [
      { label: "Date", value: "January 2026" },
      { label: "Materials", value: "Wool, clay" },
      { label: "Exhibited", value: "Moderna Dansteatern, Skeppsholmen" },
    ],
    alt: "Black and white studio photo: a large pale wool form hangs from the ceiling while a person walks past",
  },
  {
    title: "Good Wool Collective",
    summary:
      "Several of my Swedish wool lamps shown at Bergstrand Consultancy during a Good Wool Collective event in Stockholm, in a room of fashion and interior brands gathered to talk about the future of wool beyond fashion and textiles.",
    image: goodWool,
    details: [
      { label: "Date", value: "February 2026" },
      { label: "Place", value: "Bergstrand Consultancy, Stockholm" },
    ],
    alt: "Event room with clothes on rails and a long table where several glowing wool lamps stand",
  },
  {
    title: "Skymning ceiling lamp",
    summary: "Twilight's own shifts in wool. A ceiling lamp in a blend of dark Hälsinge and light Gestrike landrace wool.",
    image: skymningCeiling,
    details: [
      { label: "Date", value: "November 2025" },
      { label: "Dimensions", value: "800 × 550 × 550 mm" },
      { label: "Materials", value: "Hälsinge and Gestrike wool" },
    ],
    alt: "A large lumpy wool lamp hanging and glowing, dark and pale wool marbled together, against a grey wall",
  },
  {
    title: "Skymning table lamp",
    summary:
      "A table lamp in Swedish landrace wool. The black wool with brown tones comes from Hälsinge sheep and the light wool from Gestrike sheep.",
    image: skymningTable,
    details: [
      { label: "Date", value: "November 2025" },
      { label: "Type", value: "Table lamp" },
      { label: "Materials", value: "Hälsinge and Gestrike wool" },
    ],
    alt: "A dark, rugged wool table lamp glowing softly from within on a shelf",
  },
  {
    title: "Skymning and Värme",
    summary: "Where twilight meets warmth: the two series side by side as table lamps, shown at the Konstfack Christmas market.",
    image: skymningVarme,
    details: [
      { label: "Date", value: "November 2025" },
      { label: "Type", value: "Table lamps" },
    ],
    alt: "Two wool table lamps on a shelf, one dark and one glowing amber",
  },
  {
    title: "Värme",
    summary: "Three shapes of wool lamp: ceiling, wall and table lamp, in wool from Gestrike sheep in Roslagen.",
    image: varme,
    details: [
      { label: "Date", value: "February 2025" },
      { label: "Type", value: "Ceiling, wall and table lamp" },
      { label: "Materials", value: "Gestrike wool" },
    ],
    alt: "A dim living room lit by three amber wool lamps: one on the wall, one hanging and one on a side table",
  },
];

/** URL-safe id fragment, e.g. "nära Grannar" -> "nara-grannar". */
export const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
