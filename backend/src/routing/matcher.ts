import { categories as categoriesStore, users as usersStore } from "../db/store";
import { roleAtLeast } from "../types";

/**
 * Finds all currently online, verified answerers at the question's university
 * who are eligible to see/claim it: role must meet the category's minRole,
 * and sensitive categories are further restricted to staff members.
 */
export async function findEligibleExperts(universityId: string, categoryId: string) {
  const category = categoriesStore.findById(categoryId);
  if (!category) return [];

  const candidates = usersStore.findOnlineAnswerers(universityId);

  return candidates
    .filter((u) => (category.isSensitive ? u.isStaff === 1 : true))
    .filter((u) => roleAtLeast(u.role, category.minRole))
    .sort((a, b) => b.reputationPoints - a.reputationPoints);
}

export function eligibilityRoomName(universityId: string, categoryId: string) {
  return `queue:${universityId}:${categoryId}`;
}
