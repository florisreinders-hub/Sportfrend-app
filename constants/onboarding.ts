/**
 * Korte onboarding na de eerste keer inloggen (app/onboarding/OnboardingScreen.tsx) -
 * alle teksten op één plek, zodat een latere wijziging niet verspreid over
 * meerdere bestanden hoeft.
 */
export type OnboardingSlide = {
  /** Ionicons-naam, zie app/onboarding/OnboardingScreen.tsx. */
  icon: string;
  title: string;
  body: string;
};

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    icon: "compass-outline",
    title: "Vind iemand om mee te sporten",
    body: "Bekijk sporters bij jou in de buurt die dezelfde sport en een vergelijkbaar niveau hebben. Zie je iemand met wie je wilt trainen? Tik op Connect.",
  },
  {
    icon: "heart-outline",
    title: "Een match, dan samen sporten",
    body: "Heeft de ander ook zin om samen te sporten? Dan is het een match en kun je een training afspreken via de chat.",
  },
  {
    icon: "person-circle-outline",
    title: "Maak je profiel compleet",
    body: "Voeg een foto, een bio en je beschikbaarheid toe (ochtend, middag of avond), zodat anderen precies weten wanneer jij kunt sporten.",
  },
];

export const ONBOARDING_SKIP_LABEL = "Overslaan";
export const ONBOARDING_NEXT_LABEL = "Volgende";
export const ONBOARDING_AVAILABILITY_CTA = "Mijn beschikbaarheid invullen";
export const ONBOARDING_LATER_LABEL = "Later";
export const ONBOARDING_SETTINGS_ROW_LABEL = "Uitleg bekijken";
