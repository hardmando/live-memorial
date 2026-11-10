export interface Game {
  name: string;
  studio: string;
  /** ISO dates: launch (or first public release) and final server shutdown */
  launched: string;
  shutdown: string;
  /** YouTube video id of a trailer; absent when none survives online */
  trailer?: string;
}

// Ordered by shutdown date; the aisle is walked from oldest to newest.
export const games: Game[] = [
  { name: "WildStar", studio: "Carbine Studios", launched: "2014-06-03", shutdown: "2018-11-28", trailer: "Ru2xk7wMfus" },
  { name: "Paragon", studio: "Epic Games", launched: "2016-03-18", shutdown: "2018-04-26", trailer: "KwCAil_yWa4" },
  { name: "Evolve", studio: "Turtle Rock Studios", launched: "2015-02-10", shutdown: "2018-09-03", trailer: "VbFlIXH0OFc" },
  { name: "LawBreakers", studio: "Boss Key Productions", launched: "2017-08-08", shutdown: "2018-09-14", trailer: "gtpnVggbeoM" },
  { name: "Atlas Reactor", studio: "Trion Worlds", launched: "2016-10-04", shutdown: "2019-07-01", trailer: "LR52tRuQPyo" },
  { name: "Battleborn", studio: "Gearbox Software", launched: "2016-05-03", shutdown: "2021-01-31", trailer: "9Jo6tRAo3Dc" },
  { name: "Crucible", studio: "Relentless Studios", launched: "2020-05-20", shutdown: "2021-11-09" },
  { name: "Hyper Scape", studio: "Ubisoft Montreal", launched: "2020-08-11", shutdown: "2022-04-28", trailer: "HCc_KMDSsRM" },
  { name: "Babylon's Fall", studio: "PlatinumGames", launched: "2022-03-03", shutdown: "2023-02-27", trailer: "-PgJ4ESla4Y" },
  { name: "Rumbleverse", studio: "Iron Galaxy", launched: "2022-08-11", shutdown: "2023-02-28", trailer: "afGs9co2gVo" },
  { name: "Knockout City", studio: "Velan Studios", launched: "2021-05-21", shutdown: "2023-06-06", trailer: "DJVyyojmY1E" },
  { name: "Dauntless", studio: "Phoenix Labs", launched: "2019-05-21", shutdown: "2025-05-29", trailer: "HJulBofKwGg" },
  { name: "MultiVersus", studio: "Player First Games", launched: "2024-05-28", shutdown: "2025-05-30", trailer: "VDNhDe4eo9g" },
  { name: "XDefiant", studio: "Ubisoft", launched: "2024-05-21", shutdown: "2025-06-03", trailer: "gigfX82IHks" },
  { name: "Concord", studio: "Firewalk Studios", launched: "2024-08-23", shutdown: "2024-09-06", trailer: "xQB_2FF2G1o" },
  { name: "Anthem", studio: "BioWare", launched: "2019-02-22", shutdown: "2026-01-12", trailer: "KEMOs-44wdY" },
].sort((a, b) => a.shutdown.localeCompare(b.shutdown));

const DAY_MS = 24 * 60 * 60 * 1000;

export function lifespanDays(game: Game): number {
  return Math.round((Date.parse(game.shutdown) - Date.parse(game.launched)) / DAY_MS);
}

export function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
