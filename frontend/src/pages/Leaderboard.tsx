import { useEffect, useState } from "react";
import { University, LeaderboardEntry, Identity } from "../types";
import { api } from "../api";
import { RoleBadge } from "../components/RoleBadge";

export function Leaderboard({ identity }: { identity: Identity | null }) {
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityId, setUniversityId] = useState<string>("");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<University[]>("/api/universities")
      .then((list) => {
        setUniversities(list);
        const ownUniversityId = identity?.kind === "staff" ? identity.universityId : null;
        const defaultId = (ownUniversityId && list.some((u) => u.id === ownUniversityId) ? ownUniversityId : list[0]?.id) ?? "";
        setUniversityId(defaultId);
      })
      .catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity?.kind === "staff" ? identity.universityId : null]);

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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
