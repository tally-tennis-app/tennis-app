import type { ratings, groupStandings } from "@/src/lib/matches/queries";
export function StandingsTable({
  rows,
  records = [],
}: {
  rows: Awaited<ReturnType<typeof ratings>>;
  records?: Awaited<ReturnType<typeof groupStandings>>;
}) {
  return rows.length ? (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <caption className="pb-3 text-left">
          Ratings from confirmed, nonvoid matches. Inactive players retain their
          results.
        </caption>
        <thead>
          <tr>
            {[
              "Player",
              "Rating",
              "Rated matches",
              ...(records.length
                ? ["Wins", "Losses", "Games won", "Games lost"]
                : []),
            ].map((h) => (
              <th className="p-2" scope="col" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const record = records.find((v) => v.user_id === r.player_id);
            return (
              <tr key={r.player_id} className="border-t border-[var(--line)]">
                <th className="p-2" scope="row">
                  {r.display_name}
                  {!r.active ? " (inactive)" : ""}
                </th>
                <td className="p-2">{r.rating.toFixed(1)}</td>
                <td className="p-2">{r.matches_played}</td>
                {records.length > 0 &&
                  [
                    record?.wins ?? 0,
                    record?.losses ?? 0,
                    record?.games_won ?? 0,
                    record?.games_lost ?? 0,
                  ].map((v, i) => (
                    <td className="p-2" key={i}>
                      {v}
                    </td>
                  ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <p>No standings yet. Join a group to start playing.</p>
  );
}
