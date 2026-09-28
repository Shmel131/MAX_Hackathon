import { useEffect, useState } from "react";
import { Identity, Category, University, Role, ROLE_LABELS_RU, ROLE_ORDER } from "../types";
import { api } from "../api";

interface Expert {
  id: string;
  displayName: string;
  email: string | null;
  role: Role;
  aura: number;
  isStaff: 0 | 1 | boolean;
}

export function AdminDashboard({ user }: { user: Extract<Identity, { kind: "staff" }> }) {
  return (
    <div className="panel">
      {user.isPlatformAdmin && <PlatformAdminSection />}
      {(user.isUniversityAdmin || user.isPlatformAdmin) && user.universityId && (
        <UniversityAdminSection universityId={user.universityId} />
      )}
      {!user.isPlatformAdmin && !user.isUniversityAdmin && (
        <p className="muted">У вашего аккаунта нет прав администратора.</p>
      )}
    </div>
  );
}

function PlatformAdminSection() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => api.get<University[]>("/api/universities").then(setUniversities).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  async function createUniversity(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/universities", { name, slug, city: city || undefined });
      setName("");
      setSlug("");
      setCity("");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section>
      <h2>Платформенный админ: подключённые вузы</h2>
      {error && <p className="error-text">{error}</p>}
      <ul className="list">
        {universities.map((u) => (
          <li key={u.id}>
            <strong>{u.name}</strong> ({u.city}) — категорий: {u._count?.categories}, пользователей: {u._count?.users}
          </li>
        ))}
      </ul>

      <h3>Подключить новый вуз</h3>
      <form className="inline-form" onSubmit={createUniversity}>
        <input placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="slug (латиницей)" value={slug} onChange={(e) => setSlug(e.target.value)} required />
        <input placeholder="Город" value={city} onChange={(e) => setCity(e.target.value)} />
        <button type="submit">Добавить вуз</button>
      </form>
    </section>
  );
}

function UniversityAdminSection({ universityId }: { universityId: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [catTitle, setCatTitle] = useState("");
  const [catCode, setCatCode] = useState("");
  const [catMinRole, setCatMinRole] = useState<Role>("HELPER");
  const [catSensitive, setCatSensitive] = useState(false);

  const [expName, setExpName] = useState("");
  const [expEmail, setExpEmail] = useState("");
  const [expRole, setExpRole] = useState<Role>("HELPER");
  const [expStaff, setExpStaff] = useState(false);
  const [lastInvite, setLastInvite] = useState<{ email: string; temporaryPassword: string } | null>(null);

  const loadCategories = () =>
    api.get<Category[]>(`/api/universities/${universityId}/categories`).then(setCategories).catch((e) => setError(e.message));
  const loadExperts = () =>
    api
      .get<Expert[]>(`/api/admin/universities/${universityId}/experts`)
      .then(setExperts)
      .catch((e) => setError(e.message));

  useEffect(() => {
    loadCategories();
    loadExperts();
  }, [universityId]);

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/api/universities/${universityId}/categories`, {
        code: catCode.toUpperCase(),
        title: catTitle,
        minRole: catMinRole,
        isSensitive: catSensitive,
      });
      setCatTitle("");
      setCatCode("");
      setCatMinRole("HELPER");
      setCatSensitive(false);
      loadCategories();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function inviteExpert(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post<{ email: string; temporaryPassword: string }>(`/api/admin/universities/${universityId}/experts`, {
        displayName: expName,
        email: expEmail,
        startingRole: expRole,
        isStaff: expStaff,
      });
      setLastInvite(res);
      setExpName("");
      setExpEmail("");
      setExpRole("HELPER");
      setExpStaff(false);
      loadExperts();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function changeRole(id: string, role: Role) {
    await api.patch(`/api/admin/experts/${id}/role`, { role });
    loadExperts();
  }

  return (
    <section>
      <h2>Администрирование вуза</h2>
      {error && <p className="error-text">{error}</p>}

      <h3>Категории вопросов</h3>
      <ul className="list">
        {categories.map((c) => (
          <li key={c.id}>
            {c.title} — мин. роль: {ROLE_LABELS_RU[c.minRole]} {!!c.isSensitive && "🔒 конфиденциально"}
          </li>
        ))}
      </ul>
      <form className="inline-form" onSubmit={createCategory}>
        <input placeholder="Код (напр. CAREER)" value={catCode} onChange={(e) => setCatCode(e.target.value)} required />
        <input placeholder="Название" value={catTitle} onChange={(e) => setCatTitle(e.target.value)} required />
        <select value={catMinRole} onChange={(e) => setCatMinRole(e.target.value as Role)}>
          {ROLE_ORDER.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS_RU[r]}
            </option>
          ))}
        </select>
        <label className="checkbox">
          <input type="checkbox" checked={catSensitive} onChange={(e) => setCatSensitive(e.target.checked)} />
          конфиденциально (только штат)
        </label>
        <button type="submit">Добавить категорию</button>
      </form>

      <h3>Эксперты и волонтёры</h3>
      <ul className="list">
        {experts.map((ex) => (
          <li key={ex.id}>
            {ex.displayName} — {ROLE_LABELS_RU[ex.role]}, {ex.aura} ауры
            <select value={ex.role} onChange={(e) => changeRole(ex.id, e.target.value as Role)}>
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS_RU[r]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      <h3>Пригласить нового отвечающего</h3>
      <form className="inline-form" onSubmit={inviteExpert}>
        <input placeholder="Имя" value={expName} onChange={(e) => setExpName(e.target.value)} required />
        <input placeholder="E-mail" type="email" value={expEmail} onChange={(e) => setExpEmail(e.target.value)} required />
        <select value={expRole} onChange={(e) => setExpRole(e.target.value as Role)}>
          {ROLE_ORDER.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS_RU[r]}
            </option>
          ))}
        </select>
        <label className="checkbox">
          <input type="checkbox" checked={expStaff} onChange={(e) => setExpStaff(e.target.checked)} />
          сотрудник вуза (доступ к конфиденциальным темам)
        </label>
        <button type="submit">Пригласить</button>
      </form>
      {lastInvite && (
        <p className="muted small">
          Временный пароль для {lastInvite.email}: <code>{lastInvite.temporaryPassword}</code> (демо-режим — в реальном
          продукте отправляется приглашением, а не показывается в интерфейсе).
        </p>
      )}
    </section>
  );
}
