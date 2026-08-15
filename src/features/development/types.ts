export type SuggestionPriority = "low" | "medium" | "high";
export type SuggestionStatus = "new" | "planned" | "done";
export type SuggestionArea =
  | "kalender"
  | "handleliste"
  | "oppskrifter"
  | "barn"
  | "økonomi"
  | "utvikling"
  | "generelt";

export type DevelopmentSuggestion = {
  id: string;
  title: string;
  details: string | null;
  priority: SuggestionPriority;
  status: SuggestionStatus;
  area: SuggestionArea | null;
  createdAt: string;
  submittedByName: string;
};

export const suggestionAreaLabels: Record<SuggestionArea, string> = {
  kalender: "Kalender",
  handleliste: "Handleliste",
  oppskrifter: "Oppskrifter",
  barn: "Barn",
  økonomi: "Økonomi",
  utvikling: "Utvikling",
  generelt: "Generelt"
};
