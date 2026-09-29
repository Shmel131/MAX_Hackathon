import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastAdmin, setLastAdmin] = useState<{ email: string; temporaryPassword: string } | null>(null);

  const load = () => api.get<University[]>("/api/universities").then(setUniversities).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  async function createUniversity(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      // Onboarding a university always creates its first admin account in
      // the same step — otherwise no one could log in to run it, and a
      // platform admin would have to remember a second step every time.
      const res = await api.post<{ admin: { email: string; temporaryPassword: string } }>("/api/universities", {
        name,
        slug,
        city: city || undefined,
        adminDisplayName: adminName,
        adminEmail,
      });
      setLastAdmin(res.admin);
      setName("");
      setSlug("");
      setCity("");
      setAdminName("");
      setAdminEmail("");
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
      <p className="muted small">
        Вместе с вузом сразу создаётся аккаунт его администратора — он потом сам пригласит отвечающих и настроит
        категории.
      </p>
      <form className="inline-form" onSubmit={createUniversity}>
        <input placeholder="Название вуза" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="slug (латиницей)" value={slug} onChange={(e) => setSlug(e.target.value)} required />
        <input placeholder="Город" value={city} onChange={(e) => setCity(e.target.value)} />
        <input placeholder="Имя админа вуза" value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
        <input
          placeholder="E-mail админа вуза"
          type="email"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          required
        />
        <button type="submit">Добавить вуз</button>
      </form>
      {lastAdmin && (
        <p className="muted small">
          Данные для входа администратора вуза: e-mail <code>{lastAdmin.email}</code>, временный пароль{" "}
          <code>{lastAdmin.temporaryPassword}</code>. Войти можно по ссылке <Link to="/login">/login</Link> (кнопка
          «Войти» в шапке сайта) — там же логинятся все сотрудники вуза. Демо-режим: в реальном продукте пароль
          отправляется приглашением на почту, а не показывается в интерфейсе.
        </p>
      )}
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

  async function removeExpert(ex: Expert) {
    if (!confirm(`Удалить ${ex.displayName} из отвечающих? Аккаунт потеряет доступ, но история ответов сохранится.`)) return;
    setError(null);
    try {
      await api.delete(`/api/admin/experts/${ex.id}`);
      loadExperts();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeCategory(c: Category) {
    if (!confirm(`Удалить категорию «${c.title}»? Уже заданные по ней вопросы останутся, новые задать будет нельзя.`)) return;
    setError(null);
    try {
      await api.delete(`/api/categories/${c.id}`);
      loadCategories();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section>
      <h2>Администрирование вуза</h2>
      {error && <p className="error-text">{error}</p>}

      <h3>Роли и доступ к категориям</h3>
      <p className="muted small">
        Минимальная роль — это порог: «Знаток» видит и категории для «Помощника», «Профи» видит все. Отдельная галочка
        «конфиденциально» — это ДОПОЛНИТЕЛЬНОЕ ограничение поверх роли: такую категорию видят только сотрудники вуза
        (isStaff), даже если у волонтёра уже роль «Профи» — просто дорасти до Профи через ауру для доступа к
        конфиденциальным темам недостаточно, нужен официальный статус сотрудника.
      </p>

      <h3>Категории вопросов</h3>
      <ul className="list">
        {categories.map((c) => (
          <li key={c.id}>
            {c.title} — мин. роль: {ROLE_LABELS_RU[c.minRole]} {!!c.isSensitive && "🔒 конфиденциально"}
            <button className="danger-button" onClick={() => removeCategory(c)}>
              Удалить
            </button>
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
            <button className="danger-button" onClick={() => removeExpert(ex)}>
              Удалить
            </button>
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
          Данные для входа: e-mail <code>{lastInvite.email}</code>, временный пароль{" "}
          <code>{lastInvite.temporaryPassword}</code>. Войти можно по ссылке <Link to="/login">/login</Link> (кнопка
          «Войти» в шапке сайта). Демо-режим: в реальном продукте пароль отправляется приглашением на почту, а не
          показывается в интерфейсе.
        </p>
      )}
    </section>
  );
}
