import type { SquadAssignment, SquadSurvivor } from '../../../kernel/core/squads'

import {
  supportBonus,
  survivorRating,
} from '../../../features/commander-profile/power'

import {
  squadLeadJobs,
  squadLeaderSlotIndex,
  squadSlotCount,
} from '../../../config/constants/fortnite/squads'

/**
 * What survivors add to F.O.R.T. in a squad, and the moves that add the most.
 *
 * The rules are the game's, through `commander-profile/power.ts`: a lead
 * counts double in its own job's squad, and a support is raised by its
 * lead's rarity when their personalities match (or, under a Mythic lead,
 * lowered by 2 when they do not). Set bonuses are percentages on top and do
 * not change F.O.R.T., so nothing here ranks by them.
 */

export type ModelSurvivor = Pick<
  SquadSurvivor,
  | 'isLead'
  | 'itemId'
  | 'level'
  | 'managerSynergy'
  | 'personality'
  | 'slotIndex'
  | 'squadId'
  | 'templateId'
>

/** Slot index → occupant, for one squad. */
export type SlotMap<S> = Map<number, S>

export function ratingOf(survivor: Pick<ModelSurvivor, 'level' | 'templateId'>) {
  return survivorRating(survivor.templateId, survivor.level)
}

/**
 * Whether a lead's job is the one this squad doubles. Takes the profile's
 * `Homebase.Manager.IsDoctor` as readily as the prettified "Doctor".
 */
export function leadJobMatches(
  survivor: Pick<ModelSurvivor, 'managerSynergy'>,
  squadId: string
) {
  const job = survivor.managerSynergy
    ?.split('.')
    .pop()
    ?.replace(/^Is/, '')
    .replace(/\s+/g, '')

  return Boolean(job) && `Is${job}` === squadLeadJobs[squadId]
}

function personalitiesMatch(
  survivor: Pick<ModelSurvivor, 'personality'>,
  lead: Pick<ModelSurvivor, 'personality'>
) {
  return Boolean(survivor.personality) && survivor.personality === lead.personality
}

export type SlotScore = {
  rating: number
  /** The lead's double, or a support's match bonus or penalty. */
  bonus: number
  total: number
}

export function slotScore(
  survivor: ModelSurvivor,
  slotIndex: number,
  squadId: string,
  lead: ModelSurvivor | null
): SlotScore {
  const rating = ratingOf(survivor)
  const bonus =
    slotIndex === squadLeaderSlotIndex
      ? leadJobMatches(survivor, squadId)
        ? rating
        : 0
      : lead
        ? supportBonus(lead.templateId, personalitiesMatch(survivor, lead), rating)
        : 0

  return { bonus, rating, total: rating + bonus }
}

export function squadTotal<S extends ModelSurvivor>(slots: SlotMap<S>, squadId: string) {
  const lead = slots.get(squadLeaderSlotIndex) ?? null
  let total = 0

  slots.forEach((survivor, slotIndex) => {
    total += slotScore(survivor, slotIndex, squadId, lead).total
  })

  return total
}

export function slotMapOf<S extends ModelSurvivor>(survivors: ReadonlyArray<S>, squadId: string) {
  const slots: SlotMap<S> = new Map()

  survivors.forEach((survivor) => {
    if (survivor.squadId === squadId) {
      slots.set(survivor.slotIndex, survivor)
    }
  })

  return slots
}

export type Candidate<S> = {
  survivor: S
  /** What the survivor adds in this slot once placed. */
  score: SlotScore
  /**
   * The change to the account's F.O.R.T. A new lead also re-scores every
   * support under its personality, and a survivor taken from another squad
   * leaves a hole there, so both count.
   */
  gain: number
  /** What the survivor's current squad loses by giving it up. */
  cost: number
}

/** Everyone who can take the slot, best move first. Members of the squad are left out. */
export function rankCandidates<S extends ModelSurvivor>(
  survivors: ReadonlyArray<S>,
  squadId: string,
  slotIndex: number
): Array<Candidate<S>> {
  const wantsLead = slotIndex === squadLeaderSlotIndex
  const slots = slotMapOf(survivors, squadId)
  const before = squadTotal(slots, squadId)
  const others = new Map<string, { slots: SlotMap<S>; total: number }>()

  const costOf = (survivor: S) => {
    if (!survivor.squadId) return 0

    let other = others.get(survivor.squadId)

    if (!other) {
      const otherSlots = slotMapOf(survivors, survivor.squadId)

      other = { slots: otherSlots, total: squadTotal(otherSlots, survivor.squadId) }
      others.set(survivor.squadId, other)
    }

    const without = new Map(other.slots)

    without.delete(survivor.slotIndex)

    return other.total - squadTotal(without, survivor.squadId)
  }

  return survivors
    .filter((survivor) => survivor.isLead === wantsLead && survivor.squadId !== squadId)
    .map((survivor) => {
      const next = new Map(slots).set(slotIndex, survivor)
      const cost = costOf(survivor)

      return {
        survivor,
        score: slotScore(survivor, slotIndex, squadId, next.get(squadLeaderSlotIndex) ?? null),
        gain: squadTotal(next, squadId) - before - cost,
        cost,
      }
    })
    .sort((a, b) => b.gain - a.gain || b.score.rating - a.score.rating)
}

export type FillChange<S> = {
  squadId: string
  before: number
  after: number
  /** Survivors placed into this squad's slots. */
  moved: number
  slots: SlotMap<S>
}

export type FillPlan<S> = {
  /** Unassignments first, then placements: one batch, one profile revision. */
  assignments: Array<SquadAssignment>
  changes: Array<FillChange<S>>
  /** Survivors placed into a slot they were not in. */
  moved: number
}

function byRating<S extends ModelSurvivor>(a: S, b: S) {
  return ratingOf(b) - ratingOf(a) || a.itemId.localeCompare(b.itemId)
}

/**
 * The strongest squads that the given squads can be, from their own members
 * and the unassigned survivors. Other squads are never raided.
 *
 * Leads already in their job's squad stay, so a lineup picked on purpose
 * survives. An empty or misplaced lead slot takes the strongest lead of the
 * right job, or failing that keeps what it has. Supports then go wherever
 * they score highest; on a tie a survivor stays where it is, so a full
 * account is not shuffled for nothing.
 */
export function planAutoFill<S extends ModelSurvivor>(
  survivors: ReadonlyArray<S>,
  squadIds: ReadonlyArray<string>
): FillPlan<S> {
  const targets = new Set(squadIds)
  const pool = survivors.filter(
    (survivor) => survivor.squadId === null || targets.has(survivor.squadId)
  )
  const current = new Map(squadIds.map((squadId) => [squadId, slotMapOf(survivors, squadId)]))
  const used = new Set<string>()
  const leads = new Map<string, S | null>()

  const take = (squadId: string, lead: S | null) => {
    leads.set(squadId, lead)
    if (lead) used.add(lead.itemId)
  }
  const freeLeads = (squadId?: string) =>
    pool
      .filter(
        (survivor) =>
          survivor.isLead &&
          !used.has(survivor.itemId) &&
          (!squadId || leadJobMatches(survivor, squadId))
      )
      .sort(byRating)

  squadIds.forEach((squadId) => {
    const lead = current.get(squadId)?.get(squadLeaderSlotIndex)

    if (lead && leadJobMatches(lead, squadId)) take(squadId, lead)
  })
  squadIds.forEach((squadId) => {
    if (!leads.has(squadId)) {
      const best = freeLeads(squadId)[0]

      if (best) take(squadId, best)
    }
  })
  squadIds.forEach((squadId) => {
    if (!leads.has(squadId)) {
      const lead = current.get(squadId)?.get(squadLeaderSlotIndex)

      take(squadId, lead && !used.has(lead.itemId) ? lead : (freeLeads()[0] ?? null))
    }
  })

  const pairs = pool
    .filter((survivor) => !survivor.isLead)
    .flatMap((survivor) => {
      const rating = ratingOf(survivor)

      return squadIds.map((squadId) => {
        const lead = leads.get(squadId)

        return {
          squadId,
          survivor,
          stays: survivor.squadId === squadId,
          score:
            rating +
            (lead ? supportBonus(lead.templateId, personalitiesMatch(survivor, lead), rating) : 0),
        }
      })
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.stays) - Number(a.stays) ||
        a.survivor.itemId.localeCompare(b.survivor.itemId)
    )

  const supportSlots = squadSlotCount - 1
  const chosen = new Map(squadIds.map((squadId) => [squadId, [] as Array<S>]))

  pairs.forEach(({ squadId, survivor }) => {
    const list = chosen.get(squadId) as Array<S>

    if (used.has(survivor.itemId) || list.length >= supportSlots) return

    used.add(survivor.itemId)
    list.push(survivor)
  })

  const unassign: Array<SquadAssignment> = []
  const assign: Array<SquadAssignment> = []

  const changes = squadIds.map((squadId): FillChange<S> => {
    const before = current.get(squadId) as SlotMap<S>
    const slots: SlotMap<S> = new Map()
    const lead = leads.get(squadId)
    const members = chosen.get(squadId) as Array<S>

    if (lead) slots.set(squadLeaderSlotIndex, lead)

    // Whoever stays keeps their slot; newcomers take the free ones in order.
    const staying = members.filter(
      (survivor) => survivor.squadId === squadId && survivor.slotIndex > squadLeaderSlotIndex
    )

    staying.forEach((survivor) => slots.set(survivor.slotIndex, survivor))

    const free = Array.from({ length: supportSlots }, (_, index) => index + 1).filter(
      (slotIndex) => !slots.has(slotIndex)
    )

    members
      .filter((survivor) => !staying.includes(survivor))
      .forEach((survivor, index) => slots.set(free[index], survivor))

    const placed = assign.length

    for (let slotIndex = 0; slotIndex < squadSlotCount; slotIndex++) {
      const was = before.get(slotIndex)
      const now = slots.get(slotIndex)

      if (was?.itemId === now?.itemId) continue
      if (was) unassign.push({ characterId: was.itemId, squadId: '', slotIndex: -1 })
      if (now) assign.push({ characterId: now.itemId, squadId, slotIndex })
    }

    return {
      squadId,
      before: squadTotal(before, squadId),
      after: squadTotal(slots, squadId),
      moved: assign.length - placed,
      slots,
    }
  })

  return { assignments: [...unassign, ...assign], changes, moved: assign.length }
}
