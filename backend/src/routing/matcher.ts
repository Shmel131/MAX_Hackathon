import { categories as categoriesStore, users as usersStore } from "../db/store";
import { roleAtLeast } from "../types";

/**
 * Finds all verified answerers at the question's university who are
 * eligible to see/claim a question in this category: role must meet the
 * category's minRole, and sensitive categories are further restricted to
 * staff members. (An earlier version also required an "online" flag, but
 * that added a whole presence-tracking subsystem for no real MVP benefit —
 * every eligible answerer already polls/pushes for new questions regardless
 * of a stored online bit — so it was removed; see README changelog.)
 */
export function findEligibleExperts(universityId: string, categoryId: string) {
  const category = categoriesStore.findById(categoryId);
  if (!category) return [];

  const candidates = usersStore.findAnswerersByUniversity(universityId);

  return candidates
    .filter((u) => (category.isSensitive ? u.isStaff === 1 : true))
    .filter((u) => roleAtLeast(u.role, category.minRole))
    .sort((a, b) => b.aura - a.aura);
}

export function eligibilityRoomName(universityId: string, categoryId: string) {
  return `queue:${universityId}:${categoryId}`;
}
