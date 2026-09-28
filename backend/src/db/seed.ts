import "dotenv/config";
import bcrypt from "bcryptjs";
import { Role } from "./models";
import { universities, categories, users } from "./store";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@askvuz.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin12345";

const CATEGORY_TEMPLATE: Array<{ code: string; title: string; minRole: Role; isSensitive?: boolean; sortOrder: number }> = [
  { code: "ADMISSION", title: "Поступление", minRole: "HELPER", sortOrder: 1 },
  { code: "STUDY", title: "Учебный процесс", minRole: "HELPER", sortOrder: 2 },
  { code: "DOCS", title: "Заказ справок и документов", minRole: "KNOWER", sortOrder: 3 },
  { code: "SCHOLARSHIP", title: "Стипендии и матпомощь", minRole: "KNOWER", sortOrder: 4 },
  { code: "DORM", title: "Общежитие и быт", minRole: "HELPER", sortOrder: 5 },
  { code: "SCIENCE", title: "Наука и допобразование", minRole: "HELPER", sortOrder: 6 },
  { code: "CAREER", title: "Карьера и стажировки", minRole: "KNOWER", sortOrder: 7 },
  { code: "CAMPUS_LIFE", title: "Студенческая жизнь", minRole: "HELPER", sortOrder: 8 },
  { code: "SUPPORT", title: "Психологическая поддержка и безопасность", minRole: "PRO", isSensitive: true, sortOrder: 9 },
];

async function upsertExpert(params: {
  email: string;
  displayName: string;
  universityId: string;
  role: Role;
  aura: number;
  isStaff?: boolean;
  isUniversityAdmin?: boolean;
}) {
  const existing = users.findByEmail(params.email);
  if (existing) return existing;
  const passwordHash = await bcrypt.hash("demo12345", 10);
  return users.create({
    email: params.email,
    displayName: params.displayName,
    passwordHash,
    universityId: params.universityId,
    isAnswerer: 1,
    isStaff: params.isStaff ? 1 : 0,
    isUniversityAdmin: params.isUniversityAdmin ? 1 : 0,
    role: params.role,
    aura: params.aura,
  });
}

async function main() {
  // --- platform admin -------------------------------------------------
  if (!users.findByEmail(ADMIN_EMAIL)) {
    const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    users.create({
      email: ADMIN_EMAIL,
      displayName: "Платформенный админ",
      passwordHash: adminPasswordHash,
      isPlatformAdmin: 1,
      role: "PRO",
    });
  }

  // --- universities -----------------------------------------------------
  const uni1 =
    universities.findBySlug("itmo") ??
    universities.create({
      slug: "itmo",
      name: "Университет ИТМО",
      city: "Санкт-Петербург",
      description: "Демонстрационный вуз №1 для проверки MVP.",
    });

  const uni2 =
    universities.findBySlug("susu") ??
    universities.create({
      slug: "susu",
      name: "Южно-Уральский государственный университет",
      city: "Челябинск",
      description: "Демонстрационный вуз №2 — показывает, что ядро продукта переиспользуется для любого вуза.",
    });

  for (const uni of [uni1, uni2]) {
    for (const cat of CATEGORY_TEMPLATE) {
      categories.upsertByCode(uni.id, { ...cat, isSensitive: !!cat.isSensitive });
    }
  }

  // --- university admin ---------------------------------------------
  await upsertExpert({
    email: "uniadmin@itmo.demo",
    displayName: "Администратор ИТМО",
    universityId: uni1.id,
    role: "PRO",
    aura: 0,
    isStaff: true,
    isUniversityAdmin: true,
  });

  // --- experts across the three roles (ИТМО) ---------------------
  await upsertExpert({ email: "helper@itmo.demo", displayName: "Борис (помощник)", universityId: uni1.id, role: "HELPER", aura: 40 });
  await upsertExpert({ email: "knower@itmo.demo", displayName: "Вера (знаток)", universityId: uni1.id, role: "KNOWER", aura: 220 });
  await upsertExpert({
    email: "pro@itmo.demo",
    displayName: "Егор (профи), зам. декана",
    universityId: uni1.id,
    role: "PRO",
    aura: 900,
    isStaff: true,
  });

  await upsertExpert({ email: "helper@susu.demo", displayName: "Ирина (помощник)", universityId: uni2.id, role: "HELPER", aura: 60 });
  await upsertExpert({
    email: "pro@susu.demo",
    displayName: "Максим (профи), приёмная комиссия",
    universityId: uni2.id,
    role: "PRO",
    aura: 800,
    isStaff: true,
  });

  // eslint-disable-next-line no-console
  console.log("Seed complete.");
  // eslint-disable-next-line no-console
  console.log(`Платформенный админ: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  // eslint-disable-next-line no-console
  console.log("Демо-эксперты/админ вуза используют пароль: demo12345 (полный список — в README).");
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
