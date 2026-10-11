import type { ModelSurvivor } from './-squad-model'

import { describe, expect, it } from 'vitest'

import {
  leadJobMatches,
  planAutoFill,
  rankCandidates,
  slotMapOf,
  slotScore,
  squadTotal,
} from './-squad-model'

const emt = 'Squad_Attribute_Medicine_EMTSquad'
const fireTeam = 'Squad_Attribute_Arms_FireTeamAlpha'

let next = 0

function make(templateId: string, overrides: Partial<ModelSurvivor> = {}): ModelSurvivor {
  next += 1

  return {
    isLead: templateId.toLowerCase().includes('manager'),
    itemId: `item-${String(next).padStart(3, '0')}`,
    level: 50,
    managerSynergy: null,
    personality: null,
    slotIndex: -1,
    squadId: null,
    templateId,
    ...overrides,
  }
}

/** Mythic lead: 135 at level 50, tier 5. */
const mythicDoctor = (overrides: Partial<ModelSurvivor> = {}) =>
  make('Worker:managerdoctor_sr_kingsly_t05', {
    managerSynergy: 'Doctor',
    personality: 'Competitive',
    ...overrides,
  })

/** Legendary support: 130 at level 50, tier 5. */
const legendary = (personality: string, overrides: Partial<ModelSurvivor> = {}) =>
  make('Worker:workerbasic_sr_t05', { personality, ...overrides })

describe('slot scores', () => {
  it('doubles a lead only in its own squad', () => {
    const lead = mythicDoctor()

    expect(slotScore(lead, 0, emt, lead)).toEqual({ bonus: 135, rating: 135, total: 270 })
    expect(slotScore(lead, 0, fireTeam, lead).total).toBe(135)
  })

  it('reads the job however the profile spells it', () => {
    expect(leadJobMatches({ managerSynergy: 'Homebase.Manager.IsDoctor' }, emt)).toBe(true)
    expect(leadJobMatches({ managerSynergy: 'Martial Artist' }, 'Squad_Attribute_Arms_CloseAssaultSquad')).toBe(true)
    expect(leadJobMatches({ managerSynergy: null }, emt)).toBe(false)
  })

  it('adds 8 for a match and takes 2 for a mismatch under a Mythic lead', () => {
    const lead = mythicDoctor()

    expect(slotScore(legendary('Competitive'), 1, emt, lead).total).toBe(138)
    expect(slotScore(legendary('Dreamer'), 1, emt, lead).total).toBe(128)
    expect(slotScore(legendary('Dreamer'), 1, emt, null).total).toBe(130)
  })
})

describe('rankCandidates', () => {
  it('puts a matching survivor above a mismatched one of the same rarity', () => {
    const lead = mythicDoctor({ slotIndex: 0, squadId: emt })
    const matching = legendary('Competitive')
    const other = legendary('Dreamer')
    const [first, second] = rankCandidates([lead, other, matching], emt, 1)

    expect(first.survivor).toBe(matching)
    expect(first.gain).toBe(138)
    expect(second.gain).toBe(128)
  })

  it('scores a new lead by the whole squad it would lead', () => {
    const supports = [1, 2, 3].map((slotIndex) =>
      legendary('Dreamer', { slotIndex, squadId: emt })
    )
    const competitive = mythicDoctor()
    const dreamer = mythicDoctor({ personality: 'Dreamer' })
    const [best, worse] = rankCandidates([...supports, competitive, dreamer], emt, 0)

    expect(best.survivor).toBe(dreamer)
    // 270 for the lead, then each support moves from 130 to 138.
    expect(best.gain).toBe(270 + 3 * 8)
    expect(worse.gain).toBe(270 - 3 * 2)
  })

  it('charges a survivor taken from another squad for the hole it leaves', () => {
    const lead = mythicDoctor({ slotIndex: 0, squadId: emt })
    const otherLead = make('Worker:managersoldier_sr_ramsie_t05', {
      managerSynergy: 'Soldier',
      personality: 'Competitive',
      slotIndex: 0,
      squadId: fireTeam,
    })
    const borrowed = legendary('Competitive', { slotIndex: 1, squadId: fireTeam })
    const spare = legendary('Dreamer')
    const ranked = rankCandidates([lead, otherLead, borrowed, spare], emt, 1)
    const entry = ranked.find((candidate) => candidate.survivor === borrowed)

    // +138 here, −138 in Fire Team Alpha: a wash, so the vault survivor wins.
    expect(entry?.cost).toBe(138)
    expect(entry?.gain).toBe(0)
    expect(ranked[0].survivor).toBe(spare)
  })

  it('leaves out members of the squad', () => {
    const member = legendary('Dreamer', { slotIndex: 2, squadId: emt })

    expect(rankCandidates([member], emt, 1)).toEqual([])
  })
})

describe('planAutoFill', () => {
  it('fills an empty squad from the vault, best first', () => {
    const lead = mythicDoctor()
    const vault = [
      ...Array.from({ length: 7 }, () => legendary('Competitive')),
      legendary('Dreamer'),
    ]
    const plan = planAutoFill([lead, ...vault], [emt])
    const [change] = plan.changes

    expect(plan.moved).toBe(8)
    expect(change.slots.get(0)).toBe(lead)
    expect([...change.slots.values()].some((survivor) => survivor.personality === 'Dreamer')).toBe(false)
    expect(change.after).toBe(270 + 7 * 138)
    expect(plan.assignments.every((entry) => entry.squadId === emt)).toBe(true)
  })

  it('changes nothing in a squad that is already at its best', () => {
    const lead = mythicDoctor({ slotIndex: 0, squadId: emt })
    const members = Array.from({ length: 7 }, (_, index) =>
      legendary('Competitive', { slotIndex: index + 1, squadId: emt })
    )
    const plan = planAutoFill([lead, ...members, legendary('Competitive')], [emt])

    expect(plan.moved).toBe(0)
    expect(plan.assignments).toEqual([])
  })

  it('swaps a mismatched support out of a full squad, unassigning first', () => {
    const lead = mythicDoctor({ slotIndex: 0, squadId: emt })
    const members = [1, 2, 3, 5, 6, 7].map((slotIndex) =>
      legendary('Competitive', { slotIndex, squadId: emt })
    )
    const mismatched = legendary('Dreamer', { slotIndex: 4, squadId: emt })
    const better = legendary('Competitive')
    const plan = planAutoFill([lead, ...members, mismatched, better], [emt])

    expect(plan.assignments).toEqual([
      { characterId: mismatched.itemId, squadId: '', slotIndex: -1 },
      { characterId: better.itemId, squadId: emt, slotIndex: 4 },
    ])
    expect(plan.changes[0].after - plan.changes[0].before).toBe(10)
  })

  it('fills spare slots without moving anyone already placed', () => {
    const lead = mythicDoctor({ slotIndex: 0, squadId: emt })
    const mismatched = legendary('Dreamer', { slotIndex: 4, squadId: emt })
    const plan = planAutoFill([lead, mismatched, legendary('Competitive')], [emt])

    expect(plan.moved).toBe(1)
    expect(plan.changes[0].slots.get(4)).toBe(mismatched)
  })

  it('never takes survivors from squads it was not asked to fill', () => {
    const elsewhere = legendary('Competitive', { slotIndex: 1, squadId: fireTeam })
    const plan = planAutoFill([mythicDoctor(), elsewhere], [emt])

    expect([...plan.changes[0].slots.values()]).not.toContain(elsewhere)
  })

  it('keeps a lead in its own squad and replaces one in the wrong squad', () => {
    const misplaced = make('Worker:managersoldier_sr_ramsie_t05', {
      managerSynergy: 'Soldier',
      personality: 'Adventurous',
      slotIndex: 0,
      squadId: emt,
    })
    const doctor = mythicDoctor()
    const plan = planAutoFill([misplaced, doctor], [emt, fireTeam])
    const after = (squadId: string) =>
      plan.changes.find((change) => change.squadId === squadId)?.slots.get(0)

    expect(after(emt)).toBe(doctor)
    expect(after(fireTeam)).toBe(misplaced)
  })

  it('reports totals that match a fresh read of the result', () => {
    const lead = mythicDoctor({ slotIndex: 0, squadId: emt })
    const plan = planAutoFill([lead, legendary('Competitive'), legendary('Dreamer')], [emt])
    const [change] = plan.changes

    expect(change.before).toBe(squadTotal(slotMapOf([lead], emt), emt))
    expect(change.after).toBe(270 + 138 + 128)
  })
})
