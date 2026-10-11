import { describe, expect, it } from 'vitest'

import questRewards from '../../../data/quest-rewards.json'

import { questRewardAmount } from './accolade-xp'

describe('quest accolade xp', () => {
  it('shows the XP an accolade grants instead of its token count', () => {
    expect(questRewardAmount('STWAccoladeReward:stwaccolade_quest_general_daily', 1)).toBe(21_000)
    expect(questRewardAmount('STWAccoladeReward:stwaccolade_quest_general_weekly', 1)).toBe(136_000)
    expect(questRewardAmount('STWAccoladeReward:STWAccolade_Quest_Dungeon_Daily', 2)).toBe(102_000)
  })

  it('leaves every other reward, and unknown accolades, at their quantity', () => {
    expect(questRewardAmount('AccountResource:currency_mtxswap', 100)).toBe(100)
    expect(questRewardAmount('STWAccoladeReward:stwaccolade_quest_unknown', 1)).toBe(1)
  })

  it('knows every accolade the quest data hands out', () => {
    const accolades = Object.values(questRewards)
      .flat()
      .map((reward) => reward.templateId)
      .filter((id) => id.startsWith('STWAccoladeReward:'))

    expect(accolades.length).toBeGreaterThan(0)
    for (const id of new Set(accolades)) expect(questRewardAmount(id, 1), id).toBeGreaterThan(1)
  })
})
