import { AppPage } from "@/app/_components/app-nav";
import { ratings } from "@/src/lib/matches/queries";
import { StandingsTable } from "./table";
export const metadata = { title: "Standings" };
export default async function Standings() {
  const rows = await ratings();
  return (
    <AppPage>
      <h1 className="text-2xl font-semibold">Global standings</h1>
      <p>
        Your rating and players from your groups. Global ratings include
        confirmed play across all groups; private match details stay private.
      </p>
      <StandingsTable rows={rows} />
    </AppPage>
  );
}
