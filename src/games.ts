export interface Game {
  name: string;
  studio: string;
  /** ISO dates: launch (or first public release) and final server shutdown */
  launched: string;
  /** Absent when no official shutdown date could be confirmed */
  shutdown?: string;
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
  { name: "The Day Before", studio: "Fntastic", launched: "2023-12-07", shutdown: "2024-01-22", trailer: "ZwzmLVmak2U" },
  { name: "Highguard", studio: "Wildlight Entertainment", launched: "2026-01-26", shutdown: "2026-03-12", trailer: "uZQEns6tkNg" },
  // End of official support; Square Enix delisted it the same day
  { name: "Marvel's Avengers", studio: "Crystal Dynamics", launched: "2020-09-04", shutdown: "2023-09-30", trailer: "-sc2ayKh6uI" },
  { name: "The Crew", studio: "Ivory Tower", launched: "2014-12-02", shutdown: "2024-03-31", trailer: "PdJS_YSkgSI" },
  { name: "CrossfireX", studio: "Smilegate", launched: "2022-02-10", shutdown: "2023-05-18", trailer: "S9mZvDZVK_w" },
  // Ubisoft has not announced an end of service
  { name: "Roller Champions", studio: "Ubisoft Montreal", launched: "2022-05-25", trailer: "6PYfi7DqJZ8" },
  { name: "Spellbreak", studio: "Proletariat", launched: "2020-09-03", shutdown: "2023-01-10", trailer: "UCIVan2x_iU" },
  // Reported by players; Boss Key never published a date
  { name: "Radical Heights", studio: "Boss Key Productions", launched: "2018-04-10", shutdown: "2018-07-08", trailer: "f2q4bTB1Qyo" },
  { name: "The Cycle: Frontier", studio: "YAGER", launched: "2022-06-08", shutdown: "2023-09-27", trailer: "36Cj7Pzlabg" },
  // All but the EU and US-East servers closed on this date
  { name: "Darwin Project", studio: "Scavengers Studio", launched: "2018-03-09", shutdown: "2021-01-05", trailer: "G6aIS4NUif4" },
  // Servers faded out without an announcement; delisted from Steam 2023-06-01
  { name: "Fear the Wolves", studio: "Vostok Games", launched: "2018-08-28", trailer: "Ivkuqk7tAFI" },
  { name: "Rocket Arena", studio: "Final Strike Games", launched: "2020-07-14", shutdown: "2024-03-21", trailer: "Pi1glpgx0EU" },
  { name: "Battlefield Play4Free", studio: "Easy Studios", launched: "2011-04-04", shutdown: "2015-07-14", trailer: "ZjGrcoo7Ddg" },
  { name: "Battlefield Heroes", studio: "Easy Studios", launched: "2009-06-25", shutdown: "2015-07-14", trailer: "71bb2zEN55I" },
  { name: "Hood: Outlaws & Legends", studio: "Sumo Newcastle", launched: "2021-05-10", shutdown: "2025-02-18", trailer: "bzvzWwPQDGM" },
  { name: "Dead Island: Epidemic", studio: "Stunlock Studios", launched: "2014-05-19", shutdown: "2015-10-15", trailer: "ryY17g2dszU" },
  { name: "Resident Evil Re:Verse", studio: "Capcom", launched: "2022-10-28", shutdown: "2025-06-29", trailer: "M_UZXARzNJg" },
  // Capcom has not announced an end of service
  { name: "Resident Evil: Resistance", studio: "Capcom", launched: "2020-04-03", trailer: "QuK8ZzOHvhY" },
  { name: "Star Wars Galaxies", studio: "Sony Online Entertainment", launched: "2003-06-26", shutdown: "2011-12-15", trailer: "zqYCCxR7Da8" },
  // Unconfirmed shutdowns go last, at the far end of the aisle
].sort((a, b) => (a.shutdown ?? "9999").localeCompare(b.shutdown ?? "9999"));

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days between launch and shutdown, or null when the shutdown date is unknown */
export function lifespanDays(game: Game): number | null {
  if (!game.shutdown) return null;
  return Math.round((Date.parse(game.shutdown) - Date.parse(game.launched)) / DAY_MS);
}

/** "Launch – Shutdown" line for stones and the plaque */
export function formatSpan(game: Game): string {
  return `${formatDate(game.launched)} – ${game.shutdown ? formatDate(game.shutdown) : "date unknown"}`;
}

/** "N days online", or a fallback when the shutdown date is unknown */
export function formatLifespan(game: Game): string {
  const days = lifespanDays(game);
  if (days === null) return "servers fell silent";
  return `${days} ${days === 1 ? "day" : "days"} online`;
}

export function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
