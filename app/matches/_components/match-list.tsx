import Link from "next/link";
import type { MatchDetail } from "@/src/lib/matches/queries";
import { matchStatus } from "@/src/lib/matches/input";
export function MatchList({ matches }: { matches: MatchDetail[] }) {
  return matches.length ? (
    <ul className="grid gap-3">
      {matches.map((m) => (
        <li className="rounded border border-[var(--line)] p-4" key={m.id}>
          <Link className="font-semibold underline" href={`/matches/${m.id}`}>
            {m.player_a_profile?.display_name ?? "Player"} vs{" "}
            {m.player_b_profile?.display_name ?? "Player"}
          </Link>
          <p>
            {m.played_on} · {m.groups?.name} · {matchStatus(m)} · {m.outcome}
          </p>
          <p>
            {m.match_sets
              .toSorted((a, b) => a.set_number - b.set_number)
              .map(
                (s) =>
                  `${s.games_a}–${s.games_b}${s.complete ? "" : " (unfinished)"}`,
              )
              .join(", ") || "No score"}
          </p>
        </li>
      ))}
    </ul>
  ) : (
    <p>No matches yet. Submit a result from one of your groups.</p>
  );
}
export function Pagination({
  page,
  total,
  path,
}: {
  page: number;
  total: number;
  path: string;
}) {
  return (
    <nav aria-label="Match history pages" className="flex gap-6">
      {page > 0 && (
        <Link
          className="underline"
          href={`${path}${path.includes("?") ? "&" : "?"}page=${page - 1}`}
        >
          Previous page
        </Link>
      )}
      {(page + 1) * 25 < total && (
        <Link
          className="underline"
          href={`${path}${path.includes("?") ? "&" : "?"}page=${page + 1}`}
        >
          Next page
        </Link>
      )}
    </nav>
  );
}
