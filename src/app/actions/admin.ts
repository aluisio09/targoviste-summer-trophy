'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdminToken } from '@/lib/auth'
import { calculateStandings, groupByPosition } from '@/lib/standings'
import { generateBracketMatches } from '@/lib/bracket'
import type { TeamStanding } from '@/types'

async function requireAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (!token || !(await verifyAdminToken(token))) {
    throw new Error('Neautorizat')
  }
}

// ── Groups ────────────────────────────────────────────────

export async function createGroup(categoryId: string, name: string) {
  await requireAdmin()
  const supabase = createServiceClient()

  // Count existing groups to set display_order
  const { count } = await supabase
    .from('groups')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', categoryId)

  const { data, error } = await supabase
    .from('groups')
    .insert({ category_id: categoryId, name, display_order: (count ?? 0) + 1 })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/admin/teams')
  return data
}

export async function deleteGroup(groupId: string) {
  await requireAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase.from('groups').delete().eq('id', groupId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/teams')
}

// ── Teams ─────────────────────────────────────────────────

export async function createTeam(
  groupId: string,
  categoryId: string,
  name: string,
  shortName: string
) {
  await requireAdmin()
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('teams')
    .insert({ group_id: groupId, category_id: categoryId, name, short_name: shortName || null })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/admin/teams')
  return data
}

export async function deleteTeam(teamId: string) {
  await requireAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase.from('teams').delete().eq('id', teamId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/teams')
}

// ── Group Matches ─────────────────────────────────────────

/**
 * Grupează meciurile round-robin în runde de câte 2 simultane (2 terenuri):
 * - Constrângere strictă: în aceeași rundă nicio echipă nu apare de două ori
 * - Soft: maximizăm suma rundelor de odihnă pentru cele 4 echipe din rundă
 *
 * Returnează sloturi (array de 1 sau 2 meciuri); ultimul slot poate fi de 1
 * dacă totalul meciurilor este impar.
 */
function buildBalancedSchedule(teamIds: string[]): [string, string][][] {
  const n = teamIds.length
  if (n < 2) return []

  // Generăm toate perechile posibile
  const pairs: [string, string][] = []
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      pairs.push([teamIds[i], teamIds[j]])

  const totalPairs = pairs.length
  const remaining = new Set(pairs.map((_, k) => k))
  const lastSlot = new Map<string, number>() // echipă → indexul ultimei runde jucate
  const slots: [string, string][][] = []

  while (remaining.size > 0) {
    const si = slots.length

    // Ultimul slot dacă rămâne un singur meci (total impar)
    if (remaining.size === 1) {
      const [only] = remaining
      slots.push([pairs[only]])
      break
    }

    const rem = [...remaining]
    let bestScore = -Infinity
    let bestPair: [number, number] | null = null

    // Odihnă: echipă care nu a jucat niciodată → totalPairs+1 (maxim); altfel: si - lastSlot
    const rest = (t: string) => {
      const last = lastSlot.get(t)
      return last === undefined ? totalPairs + 1 : si - last
    }

    for (let ii = 0; ii < rem.length; ii++) {
      const [ah, aa] = pairs[rem[ii]]
      for (let jj = ii + 1; jj < rem.length; jj++) {
        const [bh, ba] = pairs[rem[jj]]

        // Constrângere strictă: nicio echipă duplicată în aceeași rundă
        if (ah === bh || ah === ba || aa === bh || aa === ba) continue

        // Scor = suma timpilor de odihnă ai celor 4 echipe
        const score = rest(ah) + rest(aa) + rest(bh) + rest(ba)
        if (score > bestScore) {
          bestScore = score
          bestPair = [rem[ii], rem[jj]]
        }
      }
    }

    if (!bestPair) {
      // Fallback teoretic (nu ar trebui să apară)
      const [first] = remaining
      slots.push([pairs[first]])
      remaining.delete(first)
      continue
    }

    const [mi, mj] = bestPair
    slots.push([pairs[mi], pairs[mj]])
    for (const t of [pairs[mi][0], pairs[mi][1], pairs[mj][0], pairs[mj][1]])
      lastSlot.set(t, si)
    remaining.delete(mi)
    remaining.delete(mj)
  }

  return slots
}

export async function generateGroupMatches(groupId: string, categoryId: string) {
  await requireAdmin()
  const supabase = createServiceClient()

  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .eq('group_id', groupId)

  if (!teams || teams.length < 3) throw new Error('Minimum 3 echipe necesare')
  if (teams.length > 7) throw new Error('Maximum 7 echipe per grupă')

  const teamIds = teams.map((t) => t.id)
  const slots = buildBalancedSchedule(teamIds)

  // Aplatizăm sloturile: meciurile 1-2 sunt runda 1, 3-4 runda 2 etc.
  const inserts: object[] = []
  let matchNum = 1
  for (const slot of slots) {
    for (const [homeId, awayId] of slot) {
      inserts.push({
        group_id: groupId,
        category_id: categoryId,
        home_team_id: homeId,
        away_team_id: awayId,
        match_number: matchNum++,
        status: 'scheduled',
      })
    }
  }

  const { error } = await supabase.from('group_matches').insert(inserts)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/matches')
}

export async function updateGroupMatchScore(
  matchId: string,
  homeScore: number,
  awayScore: number,
  status: 'scheduled' | 'live' | 'finished'
) {
  await requireAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('group_matches')
    .update({ home_score: homeScore, away_score: awayScore, status })
    .eq('id', matchId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/matches')
}

export async function setMatchLive(matchId: string) {
  await requireAdmin()
  const supabase = createServiceClient()
  await supabase.from('group_matches').update({ status: 'live' }).eq('id', matchId)
  revalidatePath('/admin/matches')
}

export async function updateGroupMatchSchedule(
  matchId: string,
  date: string | null,
  time: string | null
) {
  await requireAdmin()
  const supabase = createServiceClient()
  await supabase
    .from('group_matches')
    .update({ scheduled_date: date || null, scheduled_time: time || null })
    .eq('id', matchId)
  revalidatePath('/admin/matches')
}

export async function updateBracketMatchSchedule(
  matchId: string,
  date: string | null,
  time: string | null
) {
  await requireAdmin()
  const supabase = createServiceClient()
  await supabase
    .from('bracket_matches')
    .update({ scheduled_date: date || null, scheduled_time: time || null })
    .eq('id', matchId)
  revalidatePath('/admin/brackets')
}

// ── Brackets ──────────────────────────────────────────────

// Din primele 4 echipe (2 locuri 1 + 2 locuri 2), împerechează fiecare
// câștigătoare de grupă cu locul 2 al UNEI GRUPE DIFERITE, indiferent de
// clasarea după punctaj. Returnează [winner1, winner2, runnerUpForWinner2, runnerUpForWinner1]
// (ordinea așteptată de generateBracketMatches pentru seeding-ul de bracket-4).
function buildCrossGroupTop4(topChunk: TeamStanding[]): TeamStanding[] {
  const [winner1, winner2, runnerA, runnerB] = topChunk
  const runnerForWinner1 =
    runnerA.team.group_id !== winner1.team.group_id ? runnerA : runnerB
  const runnerForWinner2 = runnerForWinner1 === runnerA ? runnerB : runnerA
  return [winner1, winner2, runnerForWinner2, runnerForWinner1]
}

export async function generateBrackets(categoryId: string) {
  await requireAdmin()
  const supabase = createServiceClient()

  // Load all groups with their teams and matches
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, display_order')
    .eq('category_id', categoryId)
    .order('display_order')

  if (!groups || groups.length === 0) throw new Error('Nu există grupe')

  // Load teams and matches for each group
  const standingsByGroup: TeamStanding[][] = []

  for (const group of groups) {
    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .eq('group_id', group.id)

    const { data: matches } = await supabase
      .from('group_matches')
      .select('*')
      .eq('group_id', group.id)

    if (!teams || !matches) continue
    const standings = calculateStandings(matches as any, teams as any)
    standingsByGroup.push(standings)
  }

  if (standingsByGroup.length === 0) throw new Error('Nu există date')

  // Delete existing brackets for this category
  await supabase.from('brackets').delete().eq('category_id', categoryId)

  // Clasament global: loc1 din toate grupele (sortat), apoi loc2, loc3, ...
  // Cu 1 grupă de 7: r1=loc1, r2=loc2, ..., r7=loc7
  // Cu 2 grupe de 4: r1=best1st, r2=2nd1st, r3=best2nd, r4=2nd2nd, r5=best3rd, ...
  const byPosition = groupByPosition(standingsByGroup)
  const allPositions = Array.from(byPosition.keys()).sort((a, b) => a - b)

  const globalRanking: TeamStanding[] = []
  for (const pos of allPositions) {
    globalRanking.push(...(byPosition.get(pos) ?? []))
  }

  // ── Bracket principal: primele 4 echipe din clasament global ──
  // Cu mai multe grupe, semifinalele TREBUIE să opună echipe din grupe diferite:
  //   Semifinala 1: Locul 1 Grupa A vs Locul 2 Grupa B
  //   Semifinala 2: Locul 1 Grupa B vs Locul 2 Grupa A
  // Nu ne bazăm pe clasarea după punctaj (r3 vs r4), pentru că ambele echipe
  // ale unei grupe mai puternice ar putea ajunge altfel în aceeași semifinală.
  // Truc: pasăm [r1, r2, runnerUp2, runnerUp1] → buildSeedOrder(4)=[1,4,2,3]
  //   → arranged=[r1, runnerUp1, r2, runnerUp2] → Meci1: r1 vs runnerUp1, Meci2: r2 vs runnerUp2
  // 3 echipe: Final r1 vs r2, r3 bye — NU un bracket de 4 cu r1 bye+r2vr3
  const topCount = globalRanking.length === 3 ? 2 : Math.min(4, globalRanking.length)
  const topChunk = globalRanking.slice(0, topCount)
  const topEnd = topCount
  const topName = topChunk.length === 1 ? `Locul 1` : `Locurile 1-${topEnd}`

  const topSeeded: TeamStanding[] =
    topChunk.length === 4 ? buildCrossGroupTop4(topChunk) : topChunk

  const { data: topBracket, error: topErr } = await supabase
    .from('brackets')
    .insert({
      category_id: categoryId,
      name: topName,
      position_start: 1,
      position_end: topEnd,
      teams_count: topChunk.length,
      status: 'active',
    })
    .select()
    .single()
  if (topErr) throw new Error(topErr.message)
  await generateBracketMatches(topBracket.id, categoryId, topSeeded)

  // ── Bracket-uri inferioare: câte 2 echipe per bracket ──
  // Loc5 vs Loc6, Loc7 bye (sau Loc7 vs Loc8, Loc9 vs Loc10 etc. pentru mai multe grupe)
  let nextStart = topEnd + 1
  let i = topCount

  while (i < globalRanking.length) {
    const chunk = globalRanking.slice(i, i + 2)
    const posEnd = nextStart + chunk.length - 1
    const bracketName =
      chunk.length === 1 ? `Locul ${nextStart}` : `Locurile ${nextStart}-${posEnd}`

    const { data: bracket, error: bErr } = await supabase
      .from('brackets')
      .insert({
        category_id: categoryId,
        name: bracketName,
        position_start: nextStart,
        position_end: posEnd,
        teams_count: chunk.length,
        status: 'active',
      })
      .select()
      .single()
    if (bErr) throw new Error(bErr.message)
    await generateBracketMatches(bracket.id, categoryId, chunk)

    nextStart += chunk.length
    i += 2
  }

  // Mark group stage as complete
  await supabase
    .from('categories')
    .update({ group_stage_complete: true })
    .eq('id', categoryId)

  revalidatePath('/admin/brackets')
  revalidatePath(`/category/${categoryId}`)
}

export async function updateBracketMatchScore(
  matchId: string,
  homeScore: number,
  awayScore: number,
  status: 'scheduled' | 'live' | 'finished'
) {
  await requireAdmin()
  const supabase = createServiceClient()

  const { data: match, error: fetchErr } = await supabase
    .from('bracket_matches')
    .select('*')
    .eq('id', matchId)
    .single()

  if (fetchErr || !match) throw new Error('Meciul nu a fost găsit')

  const winnerId =
    status === 'finished'
      ? homeScore > awayScore
        ? match.home_team_id
        : match.away_team_id
      : null
  const loserId =
    status === 'finished'
      ? homeScore > awayScore
        ? match.away_team_id
        : match.home_team_id
      : null

  await supabase
    .from('bracket_matches')
    .update({ home_score: homeScore, away_score: awayScore, status, winner_id: winnerId })
    .eq('id', matchId)

  // Auto-advance teams to next matches
  if (status === 'finished') {
    if (match.winner_next_match_id && winnerId) {
      await supabase
        .from('bracket_matches')
        .update({ [`${match.winner_next_slot}_team_id`]: winnerId })
        .eq('id', match.winner_next_match_id)

      // Update status of next match to scheduled if both teams are now present
      const { data: nextMatch } = await supabase
        .from('bracket_matches')
        .select('home_team_id, away_team_id')
        .eq('id', match.winner_next_match_id)
        .single()
      if (nextMatch?.home_team_id && nextMatch?.away_team_id) {
        await supabase
          .from('bracket_matches')
          .update({ status: 'scheduled' })
          .eq('id', match.winner_next_match_id)
          .eq('status', 'pending')
      }
    }

    if (match.loser_next_match_id && loserId) {
      await supabase
        .from('bracket_matches')
        .update({ [`${match.loser_next_slot}_team_id`]: loserId })
        .eq('id', match.loser_next_match_id)

      const { data: loserNext } = await supabase
        .from('bracket_matches')
        .select('home_team_id, away_team_id')
        .eq('id', match.loser_next_match_id)
        .single()
      if (loserNext?.home_team_id && loserNext?.away_team_id) {
        await supabase
          .from('bracket_matches')
          .update({ status: 'scheduled' })
          .eq('id', match.loser_next_match_id)
          .eq('status', 'pending')
      }
    }
  }

  revalidatePath('/admin/brackets')
}
