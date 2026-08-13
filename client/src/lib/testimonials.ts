// Curated, real 5-star reviews from Instawork Pros who completed research
// (voice-recording) sessions. Static content — no backend. Only first names are
// shown in the UI for privacy. Swap this module for a Mode-sourced dataset later
// without touching the UI components.

export interface Testimonial {
  name: string;
  city: string;
  rating: 5;
  quote: string;
}

export interface BookingTip {
  name: string;
  city: string;
  tip: string;
}

/** Headline social proof — 2 per city, all 5★, kept short for marquee cards. */
export const TESTIMONIALS: Testimonial[] = [
  { name: "Raymond", city: "San Diego", rating: 5, quote: "Everyone there was very nice and inviting." },
  { name: "Joseph", city: "San Diego", rating: 5, quote: "Easy and very organized." },
  { name: "Shouvik", city: "Santa Clara", rating: 5, quote: "Straightforward — follow their instructions and you'll be good." },
  { name: "Ma. Linda", city: "Santa Clara", rating: 5, quote: "Team always helps when you need one." },
  { name: "Ilaura", city: "New York", rating: 5, quote: "Very well organized and efficient staff. Friendly group." },
  { name: "Demarco", city: "New York", rating: 5, quote: "Really simple & easy — I recommend." },
  { name: "Omar", city: "Boston", rating: 5, quote: "Nice easy shift. Staff are very polite and show hospitality." },
  { name: "Valentin", city: "Boston", rating: 5, quote: "Great people to work for, and the job is pretty easy." },
];

/** Longer, practical prep advice from Pros — shown in a quiet "what to know" list. */
export const BOOKING_TIPS: BookingTip[] = [
  { name: "Kyana", city: "San Diego", tip: "If your room is too cold, you can request a heater. If you tire easily, don't book these back to back." },
  { name: "Aushanai", city: "San Diego", tip: "Parking is validated — arrive early and bring a jacket." },
  { name: "Tavaria", city: "New York", tip: "Repetitive but easy; coffee and snacks are provided." },
  { name: "Janel", city: "New York", tip: "Easy work — stay alert, it's a lot of reading and speaking." },
];
