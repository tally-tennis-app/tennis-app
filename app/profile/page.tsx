import Link from "next/link";
import { AppPage } from "@/app/_components/app-nav";
import { requireUser } from "@/src/lib/auth/dal";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { ratings, ratingHistory } from "@/src/lib/matches/queries";
import { ProfileForm } from "./form";
export const metadata = { title: "Profile" };
export default async function Profile() {
  const user = await requireUser("/profile"),
    db = await createSupabaseServerClient();
  const [{ data: profile, error }, rows, history] = await Promise.all([
    db.from("profiles").select("display_name").eq("id", user.id).single(),
    ratings(),
    ratingHistory(user.id),
  ]);
  if (error) throw error;
  const rating = rows.find((r) => r.player_id === user.id);
  return (
    <AppPage>
      <h1 className="text-2xl font-semibold">Your profile</h1>
      <p>{user.email}</p>
      <ProfileForm name={profile.display_name} />
      <p>
        Global rating: <strong>{rating?.rating.toFixed(1) ?? "1500.0"}</strong>
      </p>
      <h2 className="text-xl font-semibold">Rating history</h2>
      <p>
        Ordered by confirmation, not date played. Only matches in groups you can
        still access are listed.
      </p>
      {history.length ? (
        <ul className="grid gap-3">
          {history.map((e) => (
            <li key={e.match_id}>
              <Link className="underline" href={`/matches/${e.match_id}`}>
                {new Date(e.confirmed_at).toLocaleDateString("en-US", {
                  timeZone: "UTC",
                })}
              </Link>
              : {e.rating_before.toFixed(1)} → {e.rating_after.toFixed(1)} (
              {e.delta >= 0 ? "+" : ""}
              {e.delta.toFixed(1)})
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No rated matches yet. Confirm a result with an opponent to start your
          history.
        </p>
      )}
    </AppPage>
  );
}
