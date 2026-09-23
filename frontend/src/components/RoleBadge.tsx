import { Role, ROLE_LABELS_RU, ROLE_ORDER } from "../types";

const COLORS: Record<Role, string> = {
  TRAINEE: "#9aa5b1",
  HELPER: "#4fb0ff",
  KNOWER: "#38c793",
  EXPERT: "#ffb648",
  MENTOR: "#ff7a59",
  PRO: "#8b5cf6",
};

export function RoleBadge({ role }: { role: Role }) {
  const rank = ROLE_ORDER.indexOf(role) + 1;
  return (
    <span className="role-badge" style={{ backgroundColor: COLORS[role] }} title={`Уровень ${rank} из ${ROLE_ORDER.length}`}>
      {ROLE_LABELS_RU[role]}
    </span>
  );
}
