/**
 * Battle Royale XP behind each Save the World quest accolade.
 *
 * A quest lists its XP as one `STWAccoladeReward:` item with quantity 1; the
 * amount it grants lives in the game's `STWAccoladeQuestXP` table, keyed by
 * the same row name. Base values from the installed client, October 2026.
 */
const questAccoladeXp: Record<string, number> = {
  stwaccolade_quest_general_daily: 21_000,
  stwaccolade_quest_general_weekly: 136_000,
  stwaccolade_quest_hittheroad_daily: 30_000,
  stwaccolade_quest_hittheroad_weekly: 49_000,
  stwaccolade_quest_dungeon_daily: 51_000,
  stwaccolade_quest_frostnite_daily: 17_000,
  stwaccolade_quest_frostnite_weekly: 68_000,
  stwaccolade_quest_wargames_daily: 11_000,
  stwaccolade_quest_wargames_weekly: 20_000,
  stwaccolade_quest_endurance_daily_w05: 7_000,
  stwaccolade_quest_endurance_daily_w10: 10_000,
  stwaccolade_quest_endurance_daily_w15: 10_000,
  stwaccolade_quest_endurance_daily_w20: 9_000,
  stwaccolade_quest_endurance_daily_w25: 8_000,
  stwaccolade_quest_endurance_daily_w30: 7_000,
  stwaccolade_quest_hordev3_daily_w05: 7_000,
  stwaccolade_quest_hordev3_daily_w10: 9_000,
  stwaccolade_quest_hordev3_daily_w15: 13_000,
  stwaccolade_quest_hordev3_weekly: 51_000,
}

/**
 * What a quest reward is worth on screen: the XP an accolade grants instead
 * of the token count, and the quantity unchanged for everything else.
 */
export function questRewardAmount(item: string, quantity: number) {
  const [type, id] = item.toLowerCase().split(':')
  const xp = type === 'stwaccoladereward' ? questAccoladeXp[id ?? ''] : undefined

  return xp === undefined ? quantity : xp * quantity
}
