/**
 * "Use sample rough work": wrong solutions for the demo (anchor) questions.
 * When the human adds photos at public/samples/sample-N.jpg, set imageUrl so the
 * vision path (Gemini reads handwriting) is used instead of the typed text.
 */
export interface SampleWork {
  id: string;
  /** anchor question key this sample answers */
  questionKey: string;
  label: string;
  text: string;
  imageUrl?: string;
}

export const SAMPLE_WORK: SampleWork[] = [
  {
    id: "sample-1",
    questionKey: "demo-discounts",
    label: "Jacket: successive discounts",
    text: "1. MP = ₹2000\n2. Total discount = 20% + 10% = 30%\n3. SP = 2000 × 0.7 = ₹1400",
  },
  {
    id: "sample-2",
    questionKey: "demo-avg-speed",
    label: "Cyclist: average speed",
    text: "1. Speed going = 12, coming back = 18\n2. Average speed = (12 + 18)/2 = 15\n3. Answer = 15 km/h",
  },
  {
    id: "sample-3",
    questionKey: "demo-time-work",
    label: "Ravi & Sunil: time and work",
    text: "1. Ravi takes 12 days, Sunil takes 6 days\n2. Together = 12 + 6 = 18 days\n3. Answer = 18",
  },
  {
    id: "sample-4",
    questionKey: "demo-similar-area",
    label: "Similar triangles: area",
    text: "1. Sides are in ratio 3 : 5\n2. So areas are also 3 : 5\n3. Larger area = 36 × 5/3 = 60",
  },
  {
    id: "sample-5",
    questionKey: "demo-successive-pct",
    label: "Town population: +20% then −20%",
    text: "1. Rise 20%, then fall 20%\n2. Net change = +20 − 20 = 0%\n3. Population stays 50,000",
  },
];
