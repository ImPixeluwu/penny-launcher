import type { PlannerSurvivor } from './-lineups'

import { describe, expect, it } from 'vitest'

import {
  isDamageLineup,
  lineups,
  mythicLeadKey,
  mythicLeads,
  ownedMythicLeadCount,
  planLineups,
  planSupports,
} from './-lineups'

import { survivorSquads } from '../../../config/constants/fortnite/squads'

function survivor(
  templateId: string,
  overrides: Partial<PlannerSurvivor> = {}
): PlannerSurvivor {
  return {
    itemId: `${templateId}-${overrides.squadId ?? 'vault'}-${overrides.slotIndex ?? -1}`,
    level: 50,
    personality: null,
    power: 100,
    slotIndex: -1,
    squadId: null,
    templateId,
    ...overrides,
  }
}

const scouting = 'Squad_Attribute_Scavenging_ScoutingParty'
const engineering = 'Squad_Attribute_Synthesis_CorpsofEngineering'
const fireTeam = 'Squad_Attribute_Arms_FireTeamAlpha'

describe('Mythic lead roster', () => {
  it('has three leads for every squad', () => {
    expect(mythicLeads).toHaveLength(24)
    survivorSquads.forEach((squad) => {
      expect(mythicLeads.filter((lead) => lead.squadId === squad.id)).toHaveLength(3)
    })
  })

  it('names leads by nickname', () => {
    const short = (key: string) => mythicLeads.find((lead) => lead.key === key)?.short

    expect(short('managerexplorer_sr_birdie')).toBe('Birdie')
    expect(short('managertrainer_sr_jumpy')).toBe('Sprawl')
    expect(short('managerdoctor_sr_kingsly')).toBe('Marlin Kingsly')
  })

  it('has Dragon as Adventurous, as the game data does', () => {
    expect(
      mythicLeads.find((lead) => lead.key === 'managermartialartist_sr_dragon')?.personality
    ).toBe('Adventurous')
  })
})

describe('lineups', () => {
  it('finds all 35 lineups with each personality once', () => {
    expect(lineups).toHaveLength(35)
    lineups.forEach((lineup) => {
      expect(lineup.map((lead) => lead.squadId)).toEqual(
        survivorSquads.map((squad) => squad.id)
      )
      expect(new Set(lineup.map((lead) => lead.personality)).size).toBe(8)
    })
  })

  it('has 12 damage lineups, all with Birdie', () => {
    const damage = lineups.filter(isDamageLineup)

    expect(damage).toHaveLength(12)
    damage.forEach((lineup) => {
      expect(lineup.some((lead) => lead.short === 'Birdie')).toBe(true)
    })
  })
})

describe('mythicLeadKey', () => {
  it('reads Mythic leads at any tier and ignores everyone else', () => {
    expect(mythicLeadKey('Worker:ManagerExplorer_SR_birdie_T05')).toBe(
      'managerexplorer_sr_birdie'
    )
    expect(mythicLeadKey('Worker:managerdoctor_sr_t04')).toBeNull()
    expect(mythicLeadKey('Worker:workerbasic_sr_t05')).toBeNull()
  })
})

describe('planLineups', () => {
  const birdieLeading = survivor('Worker:ManagerExplorer_SR_birdie_T05', {
    slotIndex: 0,
    squadId: scouting,
  })
  const sobsWeak = survivor('Worker:ManagerEngineer_SR_sobs_T02', { power: 40 })
  const sobsStrong = survivor('Worker:ManagerEngineer_SR_sobs_T05', { power: 120 })
  const ramsie = survivor('Worker:ManagerSoldier_SR_ramsie_T05', {
    slotIndex: 0,
    squadId: 'Squad_Attribute_Medicine_EMTSquad',
  })
  const roster = [birdieLeading, sobsWeak, sobsStrong, ramsie]

  it('ranks the lineup with the most owned leads first', () => {
    const [best] = planLineups(roster, { damageOnly: true })
    const keys = best.slots.map((slot) => slot.lead.key)

    expect(best.owned).toBe(3)
    expect(best.slotted).toBe(1)
    expect(keys).toContain('managerexplorer_sr_birdie')
    expect(keys).toContain('managerengineer_sr_sobs')
    expect(keys).toContain('managersoldier_sr_ramsie')
  })

  it('marks leads by whether they already lead their squad', () => {
    const [best] = planLineups(roster, { damageOnly: true })
    const slot = (squadId: string) => best.slots.find((entry) => entry.lead.squadId === squadId)

    expect(slot(scouting)?.state).toBe('slotted')
    expect(slot(scouting)?.copy).toBe(birdieLeading)
    // Ramsie leads the wrong squad, so he still has to move.
    expect(slot(fireTeam)?.state).toBe('owned')
    expect(slot(engineering)?.state).toBe('owned')
    expect(slot(engineering)?.copy).toBe(sobsStrong)
  })

  it('counts each Mythic lead once however many copies there are', () => {
    expect(ownedMythicLeadCount(roster)).toBe(3)
  })

  it('offers every lineup when damage is off', () => {
    expect(planLineups([], { damageOnly: false })).toHaveLength(35)
    expect(planLineups([], { damageOnly: true })).toHaveLength(12)
  })
})

describe('planSupports', () => {
  const lineup = lineups.find(
    (entry) =>
      isDamageLineup(entry) &&
      entry.some((lead) => lead.key === 'managerengineer_sr_sobs') &&
      entry.some((lead) => lead.key === 'managersoldier_sr_ramsie')
  )!

  it('sends Joel to the Dreamer squad and Karolina to the Adventurous one', () => {
    const [joel, karolina] = planSupports([], lineup)

    expect(joel.targetSquadId).toBe(engineering)
    expect(karolina.targetSquadId).toBe(fireTeam)
    expect(joel.state).toBe('missing')
  })

  it('tells placed, elsewhere and vault apart', () => {
    const [joel, karolina] = planSupports(
      [
        survivor('Worker:Worker_Joel_UR_T05', { slotIndex: 3, squadId: engineering }),
        survivor('Worker:Worker_Karolina_UR_T05'),
      ],
      lineup
    )

    expect(joel.state).toBe('placed')
    expect(karolina.state).toBe('vault')
    expect(
      planSupports(
        [survivor('Worker:Worker_Karolina_UR_T05', { slotIndex: 2, squadId: scouting })],
        lineup
      )[1].state
    ).toBe('elsewhere')
  })
})
