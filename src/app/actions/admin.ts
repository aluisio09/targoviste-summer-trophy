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

export async function generateGroupMatches(groupId: string, categoryId: string) {
  await requireAdmin()
  const supabase = createServiceClient()

  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .eq('group_id', groupId)

  if (!teams || teams.length < 3) throw new Error('Minimum 3 echipe necesare')
  if (teams.length > 7) throw new Error('Maximum 7 echipe per grupă')

  // Round-robin: each team plays every other once
  const inserts = []
  let matchNumber = 1
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      inserts.push({
        group_id: groupId,
        category_id: categoryId,
        home_team_id: teams[i].id,
        away_team_id: teams[j].id,
        match_number: matchNumber++,
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
  // Seeding 1v3 și 2v4 (nu standard 1v4, 2v3):
  //   Cu 1 grupă: semifinale loc1 vs loc3, loc2 vs loc4
  //   Cu 2 grupe: best1stPlace vs best2ndPlace, 2nd1stPlace vs 2nd2ndPlace
  // Truc: pasăm [r1, r2, r4, r3] → buildSeedOrder(4)=[1,4,2,3]
  //   → arranged=[r1, r3, r2, r4] → Meci1: r1 vs r3, Meci2: r2 vs r4
  const topCount = Math.min(4, globalRanking.length)
  const topChunk = globalRanking.slice(0, topCount)
  const topEnd = topCount
  const topName = topChunk.length === 1 ? `Locul 1` : `Locurile 1-${topEnd}`

  const topSeeded: TeamStanding[] =
    topChunk.length === 4
      ? [topChunk[0], topChunk[1], topChunk[3], topChunk[2]]
      : topChunk

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
