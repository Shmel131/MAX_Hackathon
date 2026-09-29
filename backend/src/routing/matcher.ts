import { categories as categoriesStore, users as usersStore } from "../db/store";
import { roleAtLeast } from "../types";

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
