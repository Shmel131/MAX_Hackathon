import { useEffect, useState } from "react";
import { AuthUser, LeaderboardEntry } from "../types";
import { api } from "../api";
import { RoleBadge } from "../components/RoleBadge";

export function Leaderboard({ user }: { user: AuthUser }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user.universityId) return;
    api
      .get<LeaderboardEntry[]>(`/api/universities/${user.universityId}/leaderboard`)
      .then(setEntries)
      .catch((e) => setError((e as Error).message));
  }, [user.universityId]);

  return (
    <div className="panel">
      <h2>Рейтинг экспертов вуза</h2>
      {error && <p className="error-text">{error}</p>}
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Имя</th>
            <th>Роль</th>
            <th>Баллы</th>
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
              <td>{e.reputationPoints}</td>
              <td>{e.answersCount}</td>
              <td>{e.isOnline ? "🟢" : "⚪️"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
