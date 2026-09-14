import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPage } from "@/app/_components/app-nav";
import { getMatch, ratingHistory } from "@/src/lib/matches/queries";
import { getGroup } from "@/src/lib/groups/queries";
import { matchStatus } from "@/src/lib/matches/input";
import { changeMatch } from "@/app/matches/actions";
export default async function MatchPage({
  params,
  searchParams,
}: PageProps<"/matches/[id]">) {
  const { id } = await params,
    m = await getMatch(id);
  if (!m) notFound();
  const group = await getGroup(m.group_id);
  if (!group) notFound();
  const status = matchStatus(m),
    { error } = await searchParams;
  const name = (id: string) =>
    id === m.player_a
      ? m.player_a_profile?.display_name
      : m.player_b_profile?.display_name;
  const controls: { label: string; action: string }[] = [];
  if (status === "pending") {
    if (group.viewerId === m.submitted_by)
      controls.push({ label: "Withdraw match", action: "withdraw_match" });
    else if ([m.player_a, m.player_b].includes(group.viewerId))
      controls.push(
        { label: "Confirm result", action: "confirm_match" },
        { label: "Reject result", action: "reject_match" },
      );
  }
  if (status === "confirmed" && group.viewerIsOrganizer)
    controls.push({ label: "Void confirmed match", action: "void_match" });
  const histories =
    status === "confirmed" && m.outcome !== "walkover"
      ? await Promise.all([
          ratingHistory(m.player_a),
          ratingHistory(m.player_b),
        ])
      : [];
  return (
    <AppPage>
      <h1 className="text-2xl font-semibold">
        {name(m.player_a)} vs {name(m.player_b)}
      </h1>
      <Link className="underline" href={`/groups/${m.group_id}/matches`}>
        {group.name} matches
      </Link>
      {typeof error === "string" && <p role="alert">{error}</p>}
      <p>
        {m.played_on} · {m.outcome} · <strong>{status}</strong>
      </p>
      <p>
        Winner: {name(m.winner)}
        {m.retired_by ? ` · Retired: ${name(m.retired_by)}` : ""}
      </p>
      {m.match_sets.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <caption className="text-left font-semibold">Set scores</caption>
            <thead>
              <tr>
                <th className="p-2">Set</th>
                <th className="p-2">{name(m.player_a)}</th>
                <th className="p-2">{name(m.player_b)}</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {m.match_sets
                .toSorted((a, b) => a.set_number - b.set_number)
                .map((s) => (
                  <tr
                    className="border-t border-[var(--line)]"
                    key={s.set_number}
                  >
                    <th className="p-2" scope="row">
                      {s.set_number}
                    </th>
                    <td className="p-2">
                      {s.games_a}
                      {s.tiebreak_a !== null ? ` (${s.tiebreak_a})` : ""}
                    </td>
                    <td className="p-2">
                      {s.games_b}
                      {s.tiebreak_b !== null ? ` (${s.tiebreak_b})` : ""}
                    </td>
                    <td className="p-2">
                      {s.complete ? "Finished" : "In progress"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {status === "pending" && (
        <p>
          Awaiting opponent confirmation. Pending matches expire after 14 days
          and do not count yet.
        </p>
      )}
      {status === "expired" && (
        <p>
          This submission expired after 14 days. Submit a new match to request
          confirmation.
        </p>
      )}
      {status === "void" && (
        <p>
          An organizer voided this result. Its score remains visible but it no
          longer counts.
        </p>
      )}
      {m.outcome === "walkover" && (
        <p>
          Walkovers count confirmed wins and losses but do not change ratings.
        </p>
      )}
      {histories.map((events, i) => {
        const event = events.find((e) => e.match_id === m.id);
        return event ? (
          <p key={event.player_id}>
            {name(i === 0 ? m.player_a : m.player_b)} global rating:{" "}
            {event.rating_before.toFixed(1)} → {event.rating_after.toFixed(1)} (
            {event.delta >= 0 ? "+" : ""}
            {event.delta.toFixed(1)})
          </p>
        ) : null;
      })}
      <div className="flex flex-wrap gap-4">
        {status === "pending" && group.viewerId === m.submitted_by && (
          <Link className="underline" href={`/matches/${id}/edit`}>
            Edit score
          </Link>
        )}
        {controls.map((c) => (
          <form action={changeMatch} key={c.action}>
            <input type="hidden" name="matchId" value={id} />
            <input type="hidden" name="action" value={c.action} />
            <button
              className="min-h-11 rounded border border-[var(--line)] px-4 py-2"
              type="submit"
            >
              {c.label}
            </button>
          </form>
        ))}
      </div>
      <Link className="underline" href={`/groups/${m.group_id}/standings`}>
        View group standings
      </Link>
    </AppPage>
  );
}
