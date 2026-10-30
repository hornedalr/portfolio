import type { ImageMetadata } from "astro";
import orbit from "../assets/projects/orbit.png";
import ledger from "../assets/projects/ledger.png";
import trailhead from "../assets/projects/trailhead.png";
import pixelkit from "../assets/projects/pixelkit.png";

export const profile = {
  name: "Alex Morgan",
  role: "Frontend & Creative Developer",
  location: "Stockholm, Sweden",
  tagline: "I build fast, accessible interfaces that feel effortless to use.",
  bio: [
    "I'm a developer with a background in design, focused on turning complex problems into simple, delightful web experiences.",
    "I care about performance budgets, semantic HTML and inclusive design. When I'm not shipping UI, I'm prototyping small games or photographing city architecture.",
  ],
  email: "hello@alexmorgan.dev",
  socials: [
    { label: "GitHub", href: "https://github.com/" },
    { label: "LinkedIn", href: "https://www.linkedin.com/" },
  ],
  skills: ["TypeScript", "Astro", "Tailwind CSS", "Accessibility", "Web Performance", "Figma", "Node.js", "WebGL"],
};

export interface Project {
  title: string;
  summary: string;
  tags: string[];
  image: ImageMetadata;
  alt: string;
  href?: string;
}

export const projects: Project[] = [
  {
    title: "Orbit Dashboard",
    summary: "A real-time analytics dashboard that streams satellite telemetry and renders it with sub-50ms updates.",
    tags: ["TypeScript", "WebSockets", "Canvas"],
    image: orbit,
    alt: "Purple and blue gradient with a ring orbiting a bright central circle",
  },
  {
    title: "Ledger Lite",
    summary: "A privacy-first budgeting app that keeps all data on-device and works fully offline.",
    tags: ["PWA", "IndexedDB", "Accessibility"],
    image: ledger,
    alt: "Green gradient with a rising bar chart",
  },
  {
    title: "Trailhead",
    summary: "A hiking guide site with static maps and elevation profiles, scoring 100 on every Lighthouse category.",
    tags: ["Astro", "SSG", "Maps"],
    image: trailhead,
    alt: "Orange sunset gradient behind white mountain silhouettes",
  },
  {
    title: "PixelKit",
    summary: "An open-source design token toolkit that exports themes to CSS, iOS and Android from a single source.",
    tags: ["Design Systems", "Node.js", "CLI"],
    image: pixelkit,
    alt: "Red to indigo gradient with a grid of rounded squares",
  },
];
