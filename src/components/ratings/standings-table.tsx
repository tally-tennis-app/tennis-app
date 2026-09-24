import Link from "next/link";

import { RatingDelta } from "@/src/components/matches/match-card";
import { Avatar } from "@/src/components/ui/structure";
import { formatRating } from "@/src/lib/format";
import {
  ordinal,
  type FormResult,
  type Standing,
} from "@/src/lib/ratings/types";

export function FormStrip({ form }: { form: FormResult[] }) {
  if (form.length === 0)
    return <span className="text-muted text-sm">No results</span>;

  const wins = form.filter((result) => result === "W").length;
  return (
    <span
      role="img"
      className="inline-flex gap-1"
      aria-label={`Last ${form.length}: ${wins} won, ${form.length - wins} lost, most recent first`}
    >
      {form.map((result, index) => (
        <span
          key={index}
          aria-hidden
          className={`grid size-6 place-items-center text-xs font-bold ${
            result === "W"
              ? "bg-accent text-surface"
              : "border-line-strong text-muted border"
          }`}
        >
          {result}
        </span>
      ))}
    </span>
  );
}

/**
 * One table for every width. Phones get rank, player, rating, and record;
 * wider screens add form and the last change. A table stays readable to a
 * screen reader in both.
 */
export function StandingsTable({
  standings,
  viewerId,
  caption,
  linkPlayers = true,
}: {
  standings: Standing[];
  viewerId?: string;
  caption: string;
  linkPlayers?: boolean;
}) {
  const showLast = standings.some((row) => row.lastDelta !== null);
  return (
    <div className="border-line bg-surface relative overflow-x-auto border">
      <table className="w-full text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="type-label text-muted border-line border-b">
          <tr>
            <th scope="col" className="w-14 py-3 pr-2 pl-4 font-normal">
              Rank
            </th>
            <th scope="col" className="py-3 pr-2 font-normal">
              Player
            </th>
            <th scope="col" className="py-3 pr-4 text-right font-normal">
              Rating
            </th>
            <th scope="col" className="py-3 pr-4 text-right font-normal">
              <abbr title="Wins and losses" className="no-underline">
                W-L
              </abbr>
            </th>
            <th
              scope="col"
              className="hidden py-3 pr-4 font-normal md:table-cell"
            >
              Form
            </th>
            {showLast ? (
              <th
                scope="col"
                className="hidden py-3 pr-4 text-right font-normal sm:table-cell"
              >
                Last
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-line divide-y">
          {standings.map((row) => {
            const isViewer = row.playerId === viewerId;
            return (
              <tr
                key={row.playerId}
                aria-current={isViewer ? "true" : undefined}
                className={isViewer ? "bg-surface-sunken" : undefined}
              >
                <td className="type-score py-3 pr-2 pl-4 text-lg">
                  <span aria-hidden>
                    {row.tied ? "T" : ""}
                    {row.rank}
                  </span>
                  <span className="sr-only">
                    {row.tied ? `Tied ${ordinal(row.rank)}` : ordinal(row.rank)}
                  </span>
                </td>
                <th scope="row" className="py-3 pr-2 font-normal">
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar
                      name={row.name}
                      size="sm"
                      muted={!row.active}
                      src={row.avatarUrl}
                    />
                    <span className="flex min-w-0 flex-col">
                      {linkPlayers ? (
                        <Link
                          href={`/players/${row.playerId}`}
                          className="text-ink-strong truncate font-semibold hover:underline"
                        >
                          {row.name}
                        </Link>
                      ) : (
                        <span className="text-ink-strong truncate font-semibold">
                          {row.name}
                        </span>
                      )}
                      <span className="text-muted text-xs">
                        {isViewer ? "You" : null}
                        {isViewer && !row.active ? " · " : null}
                        {!row.active ? "Former member" : null}
                      </span>
                    </span>
                  </span>
                </th>
                <td className="type-score text-ink-strong py-3 pr-4 text-right text-lg">
                  {formatRating(row.rating)}
                </td>
                <td className="py-3 pr-4 text-right text-sm tabular-nums">
                  {row.wins}-{row.losses}
                </td>
                <td className="hidden py-3 pr-4 md:table-cell">
                  <FormStrip form={row.form} />
                </td>
                {showLast ? (
                  <td className="hidden py-3 pr-4 text-right sm:table-cell">
                    {row.lastDelta === null ? (
                      <span className="text-muted text-sm">None</span>
                    ) : (
                      <RatingDelta value={row.lastDelta} />
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
