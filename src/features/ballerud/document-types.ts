export const documentCategories = {
  plan: "Plantegning",
  electrical: "Elektro",
  selection: "Tilvalg",
  prospect: "Prospekt",
  contract: "Kontrakt",
  other: "Annet"
} as const;

export type DocumentCategory = keyof typeof documentCategories;

export type BallerudDocument = {
  id: string;
  title: string;
  category: DocumentCategory;
  fileName: string;
  createdAt: string;
  url: string;
};