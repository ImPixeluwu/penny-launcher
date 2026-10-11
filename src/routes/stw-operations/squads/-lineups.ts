import type { SquadSurvivor } from '../../../kernel/core/squads'

import mythicLeadData from '../../../data/survivors-mythic-leads.json'

import { prettifyWorkerTrait } from '../../../config/constants/fortnite/items'
import {
  squadAttributeStats,
  squadLeadJobs,
  squadLeaderSlotIndex,
  survivorSquads,
} from '../../../config/constants/fortnite/squads'

/**
 * The 24 Mythic leads and the lineups they make.
 *
 * Every squad has three fixed Mythic leads, each with one personality. A
 * lineup picks one lead per squad so that all eight personalities appear
 * once: each personality then has exactly one squad to collect supports for.
 * The roster gives 35 such lineups. Twelve of them put a Dreamer lead in a
 * Tech squad and an Adventurous one in an Offense squad, which is where Joel
 * and Karolina add damage. Birdie is in all twelve.
 *
 * Jobs, personalities and names are from the v42.30 `Manager*_SR_*_T01`
 * definitions.
 */

export type MythicLead = {
  /** `managerexplorer_sr_birdie`: the template id without its tier. */
  key: string
  name: string
  /** The nickname players use ("Birdie"), or the name when there is none. */
  short: string
  personality: string
  squadId: string
  portrait: string
}

/** Lineup slots follow `survivorSquads`, one lead per squad. */
export type Lineup = Array<MythicLead>

const leadNames: Record<string, string> = {
  managerdoctor_sr_kingsly: 'Marlin Kingsly',
  managerdoctor_sr_noctor: 'Gregson "Noctor" Holmes',
  managerdoctor_sr_treky: 'May "Treky" Jenson',
  managerengineer_sr_countess: 'Lacey "Countess" Ads',
  managerengineer_sr_maths: 'Emma "Maths" Nolen',
  managerengineer_sr_sobs: 'Jeev Sobs',
  managerexplorer_sr_birdie: 'Saka "Birdie" Gale',
  managerexplorer_sr_eagle: 'Amy "Eagle" Deerhart',
  managerexplorer_sr_spacebound: 'Ned "SpaceBound" Legstrong',
  managergadgeteer_sr_fixer: 'Hamlet "Fixer" McKinney',
  managergadgeteer_sr_flak: 'Kelly "Flak" Solek',
  managergadgeteer_sr_zapps: 'Ellie "Zapps" Clerk',
  managerinventor_sr_frequency: 'Nick "Frequency" Golub',
  managerinventor_sr_rad: 'Cary "Rad" Mary',
  managerinventor_sr_square: 'Alfred "Square" Winestein',
  managermartialartist_sr_dragon: 'Sie "Dragon" Lung',
  managermartialartist_sr_samurai: 'Mishiro "Samurai" Tofune',
  managermartialartist_sr_tiger: 'Misha "Tiger" Yu',
  managersoldier_sr_malcolm: 'Malcolm',
  managersoldier_sr_princess: 'Lacy "Princess" Luw',
  managersoldier_sr_ramsie: 'Joe "Ramsie" Bo',
  managertrainer_sr_jumpy: 'Damon "Sprawl" Fitch',
  managertrainer_sr_raider: 'Cara "Indiana" Loft',
  managertrainer_sr_yoglattes: 'Michelle "Yoglattes" Jillard',
}

const squadByJob = new Map(
  Object.entries(squadLeadJobs).map(([squadId, job]) => [job, squadId])
)

export const mythicLeads: Array<MythicLead> = Object.entries(
  mythicLeadData as Record<
    string,
    { managerSynergy: string; personality: string; portrait: string }
  >
).map(([key, data]) => {
  const name = leadNames[key] ?? key

  return {
    key,
    name,
    short: /"([^"]+)"/.exec(name)?.[1] ?? name,
    personality: prettifyWorkerTrait(data.personality) ?? '',
    squadId: squadByJob.get(data.managerSynergy.split('.').pop() ?? '') ?? '',
    portrait: data.portrait,
  }
})

const leadsByKey = new Map(mythicLeads.map((lead) => [lead.key, lead]))

function squadStat(squadId: string) {
  const squad = survivorSquads.find((entry) => entry.id === squadId)

  return squad ? squadAttributeStats[squad.attribute] : null
}

function enumerateLineups() {
  const result: Array<Lineup> = []
  const picked: Lineup = []

  const visit = (index: number) => {
    if (index === survivorSquads.length) {
      result.push([...picked])

      return
    }

    mythicLeads
      .filter((lead) => lead.squadId === survivorSquads[index].id)
      .forEach((lead) => {
        if (picked.some((entry) => entry.personality === lead.personality)) {
          return
        }

        picked.push(lead)
        visit(index + 1)
        picked.pop()
      })
  }

  visit(0)

  return result
}

/** Every lineup with one Mythic lead per squad and each personality once. */
export const lineups = enumerateLineups()

/** Dreamer leads a Tech squad for Joel, Adventurous an Offense squad for Karolina. */
export function isDamageLineup(lineup: Lineup) {
  return (
    lineup.some(
      (lead) =>
        lead.personality === 'Dreamer' &&
        squadStat(lead.squadId) === 'technology'
    ) &&
    lineup.some(
      (lead) =>
        lead.personality === 'Adventurous' &&
        squadStat(lead.squadId) === 'offense'
    )
  )
}

function templateKey(templateId: string) {
  return templateId
    .toLowerCase()
    .replace(/^worker:/, '')
    .replace(/_t\d+$/, '')
}

/** `Worker:ManagerExplorer_SR_birdie_T05` → `managerexplorer_sr_birdie`; null for anyone else. */
export function mythicLeadKey(templateId: string) {
  const key = templateKey(templateId)

  return leadsByKey.has(key) ? key : null
}

export type PlannerSurvivor = Pick<
  SquadSurvivor,
  'itemId' | 'level' | 'personality' | 'slotIndex' | 'squadId' | 'templateId'
> & { power: number | null }

/** The strongest copy first, so the one worth slotting is always `[0]`. */
function byStrength<T extends PlannerSurvivor>(a: T, b: T) {
  return (b.power ?? 0) - (a.power ?? 0) || b.level - a.level
}

function copiesByKey<T extends PlannerSurvivor>(
  survivors: Array<T>,
  keyOf: (templateId: string) => string | null
) {
  const copies = new Map<string, Array<T>>()

  survivors.forEach((survivor) => {
    const key = keyOf(survivor.templateId)

    if (key) {
      copies.set(key, [...(copies.get(key) ?? []), survivor])
    }
  })
  copies.forEach((list) => list.sort(byStrength))

  return copies
}

/** How many of the 24 Mythic leads the account has at least one copy of. */
export function ownedMythicLeadCount(survivors: Array<PlannerSurvivor>) {
  return copiesByKey(survivors, mythicLeadKey).size
}

export type LeadState = 'slotted' | 'owned' | 'missing'

export type LineupSlot<T extends PlannerSurvivor = PlannerSurvivor> = {
  lead: MythicLead
  state: LeadState
  /** The copy already leading this squad, else the strongest one elsewhere. */
  copy: T | null
}

export type LineupPlan<T extends PlannerSurvivor = PlannerSurvivor> = {
  lineup: Lineup
  slots: Array<LineupSlot<T>>
  owned: number
  slotted: number
}

/**
 * The lineups ranked for this account: most leads owned, then most already
 * leading their squad. Ties keep enumeration order, so the ranking is stable.
 */
export function planLineups<T extends PlannerSurvivor>(
  survivors: Array<T>,
  { damageOnly }: { damageOnly: boolean }
): Array<LineupPlan<T>> {
  const copies = copiesByKey(survivors, mythicLeadKey)

  return lineups
    .filter((lineup) => !damageOnly || isDamageLineup(lineup))
    .map((lineup) => {
      const slots = lineup.map((lead): LineupSlot<T> => {
        const owned = copies.get(lead.key) ?? []
        const leading = owned.find(
          (copy) =>
            copy.squadId === lead.squadId &&
            copy.slotIndex === squadLeaderSlotIndex
        )

        return {
          lead,
          state: leading ? 'slotted' : owned.length > 0 ? 'owned' : 'missing',
          copy: leading ?? owned[0] ?? null,
        }
      })

      return {
        lineup,
        slots,
        owned: slots.filter((slot) => slot.state !== 'missing').length,
        slotted: slots.filter((slot) => slot.state === 'slotted').length,
      }
    })
    .sort((a, b) => b.owned - a.owned || b.slotted - a.slotted)
}

/** The two Mythic supporting survivors, from `Worker_Joel_UR` and `Worker_Karolina_UR`. */
export const mythicSupports = [
  { key: 'worker_joel_ur', name: 'Joel', personality: 'Dreamer' },
  { key: 'worker_karolina_ur', name: 'Karolina', personality: 'Adventurous' },
] as const

export type SupportState = 'placed' | 'elsewhere' | 'vault' | 'missing'

export type SupportPlan<T extends PlannerSurvivor = PlannerSurvivor> = {
  key: string
  name: string
  personality: string
  /** The lineup squad whose lead shares this survivor's personality. */
  targetSquadId: string | null
  state: SupportState
  copy: T | null
}

/** Where Joel and Karolina belong in a lineup, and where they are now. */
export function planSupports<T extends PlannerSurvivor>(
  survivors: Array<T>,
  lineup: Lineup
): Array<SupportPlan<T>> {
  const supportKeys = new Set<string>(
    mythicSupports.map((support) => support.key)
  )
  const copies = copiesByKey(survivors, (templateId) => {
    const key = templateKey(templateId)

    return supportKeys.has(key) ? key : null
  })

  return mythicSupports.map((support) => {
    const owned = copies.get(support.key) ?? []
    const targetSquadId =
      lineup.find((lead) => lead.personality === support.personality)
        ?.squadId ?? null
    const placed = owned.find(
      (copy) =>
        copy.squadId === targetSquadId &&
        copy.slotIndex !== squadLeaderSlotIndex
    )
    const slotted = owned.find((copy) => copy.squadId !== null)

    return {
      ...support,
      targetSquadId,
      state: placed
        ? 'placed'
        : slotted
          ? 'elsewhere'
          : owned.length > 0
            ? 'vault'
            : 'missing',
      copy: placed ?? slotted ?? owned[0] ?? null,
    }
  })
}
