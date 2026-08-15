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

export const suggestionAreaLabels: Record<SuggestionArea, string> = {
  kalender: "Kalender",
  handleliste: "Handleliste",
  oppskrifter: "Oppskrifter",
  barn: "Barn",
  økonomi: "Økonomi",
  utvikling: "Utvikling",
  generelt: "Generelt"
};
