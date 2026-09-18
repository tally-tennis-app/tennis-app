import { describe, expect, it } from "vitest";

import type { MatchView } from "@/src/lib/matches/types";
import {
  roundName,
  tieRoundName,
  viewerNextTie,
  type Tie,
  type TournamentDetail,
} from "@/src/lib/tournaments/types";

describe("roundName", () => {
  it("counts back from the final", () => {
    expect([1, 2, 3, 4, 5].map((round) => roundName(round, 5))).toEqual([
      "Round of 32",
      "Round of 16",
      "Quarterfinals",
      "Semifinals",
      "Final",
    ]);
    expect(roundName(1, 1)).toBe("Final");
    expect(tieRoundName(4, 5)).toBe("Semifinal");
    expect(tieRoundName(3, 5)).toBe("Quarterfinal");
    expect(tieRoundName(2, 5)).toBe("Round of 16");
  });
});

const ada = { id: "ada", name: "Ada" };
const bo = { id: "bo", name: "Bo" };

function detail(tie: Partial<Tie>): TournamentDetail {
  return {
    status: "in_progress",
    ties: [
      {
        id: "t",
        round: 1,
        position: 0,
        playerA: ada,
        playerB: bo,
        winnerId: null,
        decidedBy: null,
        deadline: null,
        match: null,
        ...tie,
      },
    ],
  } as TournamentDetail;
}

const match = (status: MatchView["status"], submitter = ada, opponent = bo) =>
  ({ status, submitter, opponent }) as MatchView;

describe("viewerNextTie", () => {
  it("asks the viewer to play once both players are known", () => {
    expect(viewerNextTie(detail({}), "ada")?.state).toBe("play");
  });

  it("waits while the opponent is still being decided", () => {
    expect(viewerNextTie(detail({ playerB: null }), "ada")?.state).toBe(
      "await",
    );
  });

  it("asks the opponent to answer a pending result, and the submitter to wait", () => {
    const d = detail({ match: match("pending") });
    expect(viewerNextTie(d, "bo")?.state).toBe("respond");
    expect(viewerNextTie(d, "ada")?.state).toBe("waiting");
  });

  it("sends a rejected result back to its submitter", () => {
    const d = detail({ match: match("rejected") });
    expect(viewerNextTie(d, "ada")?.state).toBe("fix");
    expect(viewerNextTie(d, "bo")?.state).toBe("waiting");
  });

  it("lets either player log again after an expired submission", () => {
    expect(
      viewerNextTie(detail({ match: match("expired") }), "bo")?.state,
    ).toBe("play");
  });

  it("has nothing for a decided tie or a finished tournament", () => {
    expect(
      viewerNextTie(detail({ decidedBy: "match", winnerId: "ada" }), "ada"),
    ).toBeNull();
    expect(
      viewerNextTie({ ...detail({}), status: "completed" }, "ada"),
    ).toBeNull();
  });
});
