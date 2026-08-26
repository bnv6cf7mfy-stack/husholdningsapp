// Shared display labels and input parsing helpers for the Finance dashboard tabs.
export const accountTypeLabels: Record<string, string> = {
  checking: "Brukskonto",
  buffer: "Bufferkonto",
  savings: "Sparekonto",
  other: "Annen konto"
};

export const recurrenceLabels: Record<string, string> = {
  once: "Én gang",
  monthly: "Månedlig",
  quarterly: "Kvartalsvis",
  annual: "Årlig",
  specific_dates: "Spesifikke datoer"
};

export const adjustmentLabels: Record<string, string> = {
  none: "Ingen regulering",
  fixed_annual_percent: "Fast årlig prosent",
  cpi: "KPI",
  wage_growth: "Lønnsøkning",
  interest_rate: "Rente",
  custom_assumption: "Egendefinert"
};

export const FELLES_OPTION_VALUE = "";
export const NO_CATEGORY_OPTION_VALUE = "";

const currencyFormatter = new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 });

export function formatAmount(value: number) {
  return currencyFormatter.format(value);
}

/** Accepts both "," and "." as decimal separator (Norwegian keyboards produce ","). */
export function parseAmountInput(value: string): number {
  return Number(value.trim().replace(/\s/g, "").replace(",", "."));
}

export type MemberOption = { id: string; displayName: string };

export function buildMemberOptions(householdMembers: MemberOption[]): MemberOption[] {
  return [{ id: FELLES_OPTION_VALUE, displayName: "Felles" }, ...householdMembers];
}

export type CategoryOption = { id: string; parentId: string | null; name: string };

export function buildCategoryOptions(categories: CategoryOption[]): { id: string; label: string }[] {
  return categories
    .slice()
    .sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0))
    .map((category) => {
      const parent = category.parentId ? categories.find((c) => c.id === category.parentId) : null;
      return {
        id: category.id,
        label: parent ? `${parent.name} \u203a ${category.name}` : category.name
      };
    });
}
