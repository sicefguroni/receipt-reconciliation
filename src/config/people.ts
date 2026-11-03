// Simulated people (03 non-goal: no real authentication). The header switcher picks who is
// acting, so R-APR-1 (no self-approval) can be shown and tested. Ids match the sample month.

export const PEOPLE = [
  { id: "accounts", label: "Accounting user (reviewer)" },
  { id: "staff-a", label: "Staff A" },
  { id: "staff-b", label: "Staff B" },
  { id: "staff-c", label: "Staff C" },
  { id: "staff-d", label: "Staff D" },
  { id: "staff-e", label: "Staff E" },
] as const;

export const DEFAULT_ACTOR = "accounts";

export function personLabel(id: string): string {
  return PEOPLE.find((p) => p.id === id)?.label ?? id;
}

export function isPerson(id: string | undefined): id is string {
  return PEOPLE.some((p) => p.id === id);
}
