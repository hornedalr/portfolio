import type { ImageMetadata } from "astro";
import orbit from "../assets/projects/orbit.png";
import ledger from "../assets/projects/ledger.png";
import trailhead from "../assets/projects/trailhead.png";
import pixelkit from "../assets/projects/pixelkit.png";

export const profile = {
  name: "Lara Braun",
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
  image: ImageMetadata;
  alt: string;
  /** Small facts shown under the title, e.g. date, duration, dimensions. */
  details: { label: string; value: string }[];
  href?: string;
}

export const projects: Project[] = [
  {
    title: "Orbit Dashboard",
    summary: "A real-time analytics dashboard that streams satellite telemetry and renders it with sub-50ms updates.",
    image: orbit,
    details: [
      { label: "Date", value: "March 2025" },
      { label: "Duration", value: "6 weeks" },
      { label: "Dimensions", value: "120 × 80 cm" },
    ],
    alt: "Cream background with a charcoal ring orbiting a pale circle and a small brown dot",
  },
  {
    title: "Ledger Lite",
    summary: "A privacy-first budgeting app that keeps all data on-device and works fully offline.",
    image: ledger,
    details: [
      { label: "Date", value: "November 2024" },
      { label: "Duration", value: "3 weeks" },
      { label: "Dimensions", value: "60 × 60 cm" },
    ],
    alt: "Oatmeal to grey gradient with a rising bar chart, one bar highlighted in brown",
  },
  {
    title: "Trailhead",
    summary: "A hiking guide site with static maps and elevation profiles, scoring 100 on every Lighthouse category.",
    image: trailhead,
    details: [
      { label: "Date", value: "June 2024" },
      { label: "Duration", value: "2 months" },
      { label: "Dimensions", value: "200 × 140 cm" },
    ],
    alt: "Grey gradient behind a cream mountain ridge and a pale brown sun",
  },
  {
    title: "PixelKit",
    summary: "An open-source design token toolkit that exports themes to CSS, iOS and Android from a single source.",
    image: pixelkit,
    details: [
      { label: "Date", value: "January 2024" },
      { label: "Duration", value: "10 days" },
      { label: "Dimensions", value: "40 × 30 cm" },
    ],
    alt: "Charcoal background with a grid of cream and grey squares, one in brown",
  },
];
