import { useEffect, useState } from "react";
import { University, LeaderboardEntry } from "../types";
import { api } from "../api";
import { RoleBadge } from "../components/RoleBadge";

/** Public — visible to students as well as staff (see requirement: рейтинг не
 * только у отвечающих, но и у студентов). No login required to view it. */
export function Leaderboard() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityId, setUniversityId] = useState<string>("");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<University[]>("/api/universities")
      .then((list) => {
        setUniversities(list);
        if (list.length > 0) setUniversityId(list[0].id);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    if (!universityId) return;
    api
      .get<LeaderboardEntry[]>(`/api/universities/${universityId}/leaderboard`)
      .then(setEntries)
      .catch((e) => setError((e as Error).message));
  }, [universityId]);

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>Рейтинг специалистов по ауре</h2>
        <select value={universityId} onChange={(e) => setUniversityId(e.target.value)}>
          {universities.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="error-text">{error}</p>}
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Имя</th>
            <th>Роль</th>
            <th>Аура</th>
            <th>Ответов</th>
            <th>Онлайн</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={e.id}>
              <td>{i + 1}</td>
              <td>{e.displayName}</td>
              <td>
                <RoleBadge role={e.role} />
              </td>
              <td>{e.aura}</td>
              <td>{e.answersCount}</td>
              <td>{e.isOnline ? "🟢" : "⚪️"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
