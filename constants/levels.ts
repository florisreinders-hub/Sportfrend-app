import { SelectOption } from "@/components/SelectModal";

// value: null = "Alle niveaus" - only meaningful as a filter option, not a
// pickable level for a profile (callers that don't want that option, e.g.
// EditProfileScreen, slice it off). Values match the profiles table's
// level check constraint (profiles_level_check) exactly - keep in sync if
// that constraint ever changes.
export const LEVEL_OPTIONS: SelectOption[] = [
  { label: "Alle niveaus", value: null },
  { label: "Beginner", value: "beginner" },
  { label: "Gevorderd", value: "gevorderd" },
  { label: "Competitief", value: "competitief" },
];
