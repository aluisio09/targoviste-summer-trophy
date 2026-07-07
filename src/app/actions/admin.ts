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
  if (teams.length > 6) throw new Error('Maximum 6 echipe per grupă')

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

  // Group teams by position across all groups
  const byPosition = groupByPosition(standingsByGroup)

  // ── Bracket principal: locurile 1 și 2 din toate grupele ──
  // 2 grupe → 4 echipe → "Locurile 1-4"
  // 3 grupe → 6 echipe → "Locurile 1-6" (nextPow2=8, 2 bye-uri)
  // 4 grupe → 8 echipe → "Locurile 1-8"
  const pos1Teams = byPosition.get(1) ?? []
  const pos2Teams = byPosition.get(2) ?? []
  const champTeams = [...pos1Teams, ...pos2Teams]
  const champEnd = champTeams.length

  if (champTeams.length > 0) {
    const { data: champBracket, error: cErr } = await supabase
      .from('brackets')
      .insert({
        category_id: categoryId,
        name: `Locurile 1-${champEnd}`,
        position_start: 1,
        position_end: champEnd,
        teams_count: champTeams.length,
        status: 'active',
      })
      .select()
      .single()

    if (cErr) throw new Error(cErr.message)
    await generateBracketMatches(champBracket.id, categoryId, champTeams)
  }

  // ── Bracket-uri de consolare: pozițiile 3, 4, 5, 6 ──
  // Dacă grupele au mărimi diferite, o poziție poate avea mai puțin de numGroups echipe
  // (ex. poziția 5 cu 1 echipă când o grupă are 5 și alta 4 → bracket "Locul 9")
  const maxPos = Math.max(...Array.from(byPosition.keys()))
  let nextStart = champEnd + 1

  for (let pos = 3; pos <= maxPos; pos++) {
    const teamsAtPos = byPosition.get(pos)
    if (!teamsAtPos?.length) continue

    const posEnd = nextStart + teamsAtPos.length - 1
    const bracketName =
      teamsAtPos.length === 1 ? `Locul ${nextStart}` : `Locurile ${nextStart}-${posEnd}`

    const { data: bracket, error: bErr } = await supabase
      .from('brackets')
      .insert({
        category_id: categoryId,
        name: bracketName,
        position_start: nextStart,
        position_end: posEnd,
        teams_count: teamsAtPos.length,
        status: 'active',
      })
      .select()
      .single()

    if (bErr) throw new Error(bErr.message)
    await generateBracketMatches(bracket.id, categoryId, teamsAtPos)
    nextStart = posEnd + 1
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
