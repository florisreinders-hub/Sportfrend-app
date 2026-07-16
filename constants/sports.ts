import { SelectOption } from "@/components/SelectModal";

// value: null = "Alle sporten" - only meaningful as a filter option, not a
// pickable sport for a profile or post (callers that don't want that option,
// e.g. NewPostScreen, slice it off).
export const SPORT_OPTIONS: SelectOption[] = [
  { label: "Alle sporten", value: null },
  { label: "Padel", value: "Padel" },
  { label: "Tennis", value: "Tennis" },
  { label: "Golf", value: "Golf" },
  { label: "Hardlopen", value: "Hardlopen" },
  { label: "Fitness", value: "Fitness" },
  { label: "Voetbal", value: "Voetbal" },
  { label: "Basketbal", value: "Basketbal" },
  { label: "Volleybal", value: "Volleybal" },
  { label: "Badminton", value: "Badminton" },
  { label: "Squash", value: "Squash" },
  { label: "Wielrennen", value: "Wielrennen" },
  { label: "Zwemmen", value: "Zwemmen" },
  { label: "Klimmen", value: "Klimmen" },
  { label: "Yoga", value: "Yoga" },
  { label: "Crossfit", value: "Crossfit" },
];
