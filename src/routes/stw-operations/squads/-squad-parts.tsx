import type { DecoratedSurvivor } from './-hooks'
import type { ItemRecordMap } from '../../../kernel/core/item-database'

import {
  Artboard,
  BadgeMark,
  badgeUrl,
  setBonusInfo,
} from '../../../components/items/artboard'
import { resolveItemArt } from '../../../components/items/item-icon'

import { shortSetBonus } from './-hooks'

import { prettifyWorkerTrait } from '../../../config/constants/fortnite/items'

import { cn } from '../../../lib/utils'

/** The squad's own emblem, as the game and the site draw it. */
export const squadEmblems: Record<string, string> = {
  Squad_Attribute_Arms_CloseAssaultSquad: 'squads-close_assault_squad',
  Squad_Attribute_Arms_FireTeamAlpha: 'squads-fire_team_alpha_squad',
  Squad_Attribute_Medicine_EMTSquad: 'squads-emt_squad',
  Squad_Attribute_Medicine_TrainingTeam: 'squads-training_team_squad',
  Squad_Attribute_Scavenging_Gadgeteers: 'squads-gadgeteers_squad',
  Squad_Attribute_Scavenging_ScoutingParty: 'squads-scouting_party_squad',
  Squad_Attribute_Synthesis_CorpsofEngineering: 'squads-engineering_squad',
  Squad_Attribute_Synthesis_TheThinkTank: 'squads-think_tank_squad',
}

export function SquadEmblem({ className, squadId }: { className?: string; squadId: string }) {
  const src = badgeUrl(squadEmblems[squadId] ?? '')

  return src ? (
    <img alt="" className={cn('shrink-0 object-contain', className)} src={src} />
  ) : (
    <span className={cn('shrink-0', className)} />
  )
}

/**
 * How many survivors of one set bonus it takes to switch it on, and what one
 * activation is worth — the table PennyDB publishes with every profile
 * (`survivor_bonus_overview`), so the launcher and the site agree.
 */
const setRules: Record<string, { need: number; pct: number }> = {
  'Ability Damage': { need: 3, pct: 5 },
  Health: { need: 2, pct: 5 },
  'Melee Damage': { need: 3, pct: 5 },
  'Ranged Damage': { need: 3, pct: 5 },
  Shield: { need: 2, pct: 5 },
  'Shield Regeneration': { need: 2, pct: 5 },
  'Trap Damage': { need: 3, pct: 5 },
  'Trap Durability': { need: 2, pct: 8 },
}

/** Every set bonus, in the order the site's board lists them. */
export const setBonusOrder: Array<{ label: string; file: string }> = [
  { label: 'Trap Durability', file: 'survivors-trap_durability' },
  { label: 'Trap Damage', file: 'survivors-trap_damage' },
  { label: 'Ability Damage', file: 'survivors-ability_damage' },
  { label: 'Ranged Damage', file: 'survivors-ranged_weapon_damage' },
  { label: 'Melee Damage', file: 'survivors-melee_weapon_damage' },
  { label: 'Health', file: 'survivors-health' },
  { label: 'Shield', file: 'survivors-shield' },
  { label: 'Shield Regeneration', file: 'survivors-shield_regeneration' },
]

export type SetTally = {
  label: string
  file: string
  count: number
  need: number
  pct: number
  /** Completed sets. */
  active: number
  /** Survivors past the last full set: they add nothing until it completes. */
  spare: number
}

type SetMember = { slotIndex: number; setBonus: string | null }

/** The set bonuses one squad's supports carry, most complete first. */
export function tallySets(members: Iterable<SetMember>): Array<SetTally> {
  const counts = new Map<string, { file: string; count: number }>()

  for (const member of members) {
    const info = member.slotIndex > 0 ? setBonusInfo(member.setBonus) : null

    if (info) {
      const entry = counts.get(info.label) ?? { file: info.file, count: 0 }

      entry.count += 1
      counts.set(info.label, entry)
    }
  }

  return [...counts.entries()]
    .map(([label, { count, file }]) => {
      const { need, pct } = setRules[label] ?? { need: 3, pct: 5 }

      return {
        label,
        file,
        count,
        need,
        pct,
        active: Math.floor(count / need),
        spare: count % need,
      }
    })
    .sort((a, b) => b.active - a.active || b.count - a.count)
}

/** Each set bonus's total across the given squads, in percent. */
export function setTotals(squads: Iterable<Iterable<SetMember>>) {
  const totals = new Map<string, number>()

  for (const members of squads) {
    tallySets(members).forEach((entry) => {
      totals.set(entry.label, (totals.get(entry.label) ?? 0) + entry.active * entry.pct)
    })
  }

  return totals
}

/** Set progress as pips, one group per set: a full group is a working set. */
export function SetPips({ count, need }: { count: number; need: number }) {
  const groups = Math.max(1, Math.ceil(count / need))

  return (
    <span aria-hidden className="flex items-center gap-1.5">
      {Array.from({ length: groups }, (_, group) => {
        const complete = (group + 1) * need <= count

        return (
          <span className="flex gap-0.5" key={group}>
            {Array.from({ length: need }, (_, index) => (
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  group * need + index >= count
                    ? 'bg-muted'
                    : complete
                      ? 'bg-primary'
                      : 'bg-warning'
                )}
                key={index}
              />
            ))}
          </span>
        )
      })}
    </span>
  )
}

function personalityMark(personality: string | null) {
  const src = personality
    ? badgeUrl(`survivors-${personality.toLowerCase().replace(/\s+/g, '_')}`)
    : null

  return src && personality ? { label: personality, src } : null
}

/** A survivor's portrait on its rarity plate, its personality in the corner. */
export function SurvivorArt({
  className,
  dim = false,
  personality,
  portrait,
  records,
  templateId,
}: {
  className?: string
  dim?: boolean
  personality?: string | null
  portrait?: string | null
  records: ItemRecordMap
  templateId: string
}) {
  const art = resolveItemArt(templateId, records, portrait)
  const mark = personalityMark(personality ?? null)

  return (
    <Artboard
      className={cn('shrink-0 rounded-md', dim && 'opacity-40 grayscale', className)}
      rarity={art.rarity}
    >
      {art.imgUrl && (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover object-top"
          decoding="async"
          loading="lazy"
          src={art.imgUrl}
        />
      )}
      {mark && (
        <span className="absolute left-0.5 top-0.5">
          <BadgeMark className="size-4" mark={mark} />
        </span>
      )}
    </Artboard>
  )
}

/**
 * The line under a survivor's name: what tells it apart. A lead's job, a
 * support's set bonus, the level — and the personality whenever the name
 * is not already it.
 */
export function SurvivorTraits({ survivor }: { survivor: DecoratedSurvivor }) {
  const set = survivor.isLead ? null : setBonusInfo(survivor.setBonus)
  const setSrc = set ? badgeUrl(set.file) : null
  const job = prettifyWorkerTrait(survivor.managerSynergy)
  const parts: Array<string> = []

  if (survivor.personality && survivor.personality !== survivor.name) {
    parts.push(survivor.personality)
  }
  if (survivor.isLead && job && job !== survivor.name) {
    parts.push(job)
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      {parts.length > 0 && <span className="truncate">{parts.join(' · ')}</span>}
      {set && (
        <span className="flex min-w-0 items-center gap-1">
          {parts.length > 0 && <span aria-hidden>·</span>}
          {setSrc && <img alt="" className="size-3.5 shrink-0 object-contain" src={setSrc} />}
          <span className="truncate">{shortSetBonus(set.label)}</span>
        </span>
      )}
      <span className="shrink-0">
        {(parts.length > 0 || set) && <span aria-hidden>· </span>}
        Lv <span className="figure">{survivor.level}</span>
      </span>
    </span>
  )
}

export function formatGain(gain: number) {
  const rounded = Math.round(gain)

  if (rounded === 0) return '±0'

  return rounded > 0
    ? `+${rounded.toLocaleString()}`
    : `−${Math.abs(rounded).toLocaleString()}`
}

/** The set bonuses the account has working, added up across all eight squads. */
export function SetBonusStrip({
  squads,
}: {
  squads: Array<{ slots: Array<{ slotIndex: number; survivor: { setBonus: string | null } | null }> }>
}) {
  const totals = setTotals(
    squads.map((squad) =>
      squad.slots.map((slot) => ({
        slotIndex: slot.slotIndex,
        setBonus: slot.survivor?.setBonus ?? null,
      }))
    )
  )
  const active = setBonusOrder.filter(({ label }) => (totals.get(label) ?? 0) > 0)

  if (active.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Set bonuses</span>
      {active.map(({ file, label }) => {
        const src = badgeUrl(file)

        return (
          <span className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1" key={label}>
            {src && <img alt="" className="size-4 object-contain" src={src} />}
            <span className="text-xs font-medium">{label}</span>
            <span className="figure text-xs font-semibold text-primary">+{totals.get(label)}%</span>
          </span>
        )
      })}
    </div>
  )
}
