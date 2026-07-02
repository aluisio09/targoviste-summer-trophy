import type { GroupMatch, Team, TeamStanding } from '@/types'

interface H2HStats {
  points: number
  gd: number      // goal difference in H2H matches
  gf: number      // goals scored in H2H matches
}

/**
 * Computes head-to-head stats between a specific set of teams,
 * considering only the matches played among those teams.
 */
function calculateH2HStats(
  teamIds: string[],
  finishedMatches: GroupMatch[]
): Map<string, H2HStats> {
  const stats = new Map<string, H2HStats>()
  teamIds.forEach((id) => stats.set(id, { points: 0, gd: 0, gf: 0 }))

  for (const match of finishedMatches) {
    if (!teamIds.includes(match.home_team_id)) continue
    if (!teamIds.includes(match.away_team_id)) continue
    if (match.home_score === null || match.away_score === null) continue

    const home = stats.get(match.home_team_id)!
    const away = stats.get(match.away_team_id)!

    home.gf += match.home_score
    home.gd += match.home_score - match.away_score
    away.gf += match.away_score
    away.gd += match.away_score - match.home_score

    if (match.home_score > match.away_score) {
      home.points += 3
    } else if (match.home_score < match.away_score) {
      away.points += 3
    } else {
      home.points += 1
      away.points += 1
    }
  }

  return stats
}

/**
 * Sorts a list of standings with full tiebreaker logic:
 * 1. Puncte (V=3, E=1, I=0)
 * 2. Confruntare directă între echipele la egalitate de puncte:
 *    a) Puncte în confruntare directă
 *    b) Golaveraj în confruntare directă
 *    c) Goluri înscrise în confruntare directă
 * 3. Golaveraj total (mai mare = mai bun)
 * 4. Goluri înscrise total (mai multe = mai bun)
 * 5. Goluri primite total (mai puține = mai bun)
 * 6. Ordine alfabetică (ultimul resort)
 */
function sortWithTiebreakers(
  standings: TeamStanding[],
  finishedMatches: GroupMatch[]
): TeamStanding[] {
  // Group teams by points so we can compute H2H within each group
  const byPoints = new Map<number, TeamStanding[]>()
  for (const s of standings) {
    if (!byPoints.has(s.points)) byPoints.set(s.points, [])
    byPoints.get(s.points)!.push(s)
  }

  const result: TeamStanding[] = []

  // Process each points group from highest to lowest
  const pointGroups = Array.from(byPoints.entries()).sort(([a], [b]) => b - a)

  for (const [, group] of pointGroups) {
    if (group.length === 1) {
      result.push(group[0])
      continue
    }

    // Compute H2H only among the tied teams
    const teamIds = group.map((s) => s.team.id)
    const h2h = calculateH2HStats(teamIds, finishedMatches)

    const sorted = [...group].sort((a, b) => {
      const aH = h2h.get(a.team.id)!
      const bH = h2h.get(b.team.id)!

      // a) Puncte confruntare directă
      if (bH.points !== aH.points) return bH.points - aH.points
      // b) Golaveraj confruntare directă
      if (bH.gd !== aH.gd) return bH.gd - aH.gd
      // c) Goluri înscrise confruntare directă
      if (bH.gf !== aH.gf) return bH.gf - aH.gf
      // 3. Golaveraj total
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
      // 4. Goluri înscrise total
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
      // 5. Goluri primite total (mai puține = mai bun)
      if (a.goals_against !== b.goals_against) return a.goals_against - b.goals_against
      // 6. Alfabetic
      return a.team.name.localeCompare(b.team.name)
    })

    result.push(...sorted)
  }

  return result
}

export function calculateStandings(
  matches: GroupMatch[],
  teams: Team[]
): TeamStanding[] {
  const map = new Map<string, TeamStanding>()

  teams.forEach((team) => {
    map.set(team.id, {
      team,
      position: 0,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      points: 0,
    })
  })

  const finishedMatches = matches.filter(
    (m) => m.status === 'finished' && m.home_score !== null && m.away_score !== null
  )

  for (const match of finishedMatches) {
    const home = map.get(match.home_team_id)
    const away = map.get(match.away_team_id)
    if (!home || !away) continue

    const hs = match.home_score!
    const as_ = match.away_score!

    home.played++
    away.played++
    home.goals_for += hs
    home.goals_against += as_
    away.goals_for += as_
    away.goals_against += hs

    if (hs > as_) {
      home.won++
      home.points += 3
      away.lost++
    } else if (hs < as_) {
      away.won++
      away.points += 3
      home.lost++
    } else {
      home.drawn++
      away.drawn++
      home.points += 1
      away.points += 1
    }
  }

  // Compute goal_difference before sorting
  const all = Array.from(map.values()).map((s) => ({
    ...s,
    goal_difference: s.goals_for - s.goals_against,
  }))

  const sorted = sortWithTiebreakers(all, finishedMatches)

  return sorted.map((s, i) => ({ ...s, position: i + 1 }))
}

// Groups all standings by position (1st place teams, 2nd place teams, etc.)
export function groupByPosition(
  standingsByGroup: TeamStanding[][]
): Map<number, TeamStanding[]> {
  const byPosition = new Map<number, TeamStanding[]>()

  for (const groupStandings of standingsByGroup) {
    groupStandings.forEach((standing, idx) => {
      const pos = idx + 1
      if (!byPosition.has(pos)) byPosition.set(pos, [])
      byPosition.get(pos)!.push(standing)
    })
  }

  // Sort within each position group (for bracket seeding) using the same criteria
  // but without H2H (teams come from different groups, no H2H available)
  byPosition.forEach((teams, pos) => {
    byPosition.set(
      pos,
      teams.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
        if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
        if (a.goals_against !== b.goals_against) return a.goals_against - b.goals_against
        return a.team.name.localeCompare(b.team.name)
      })
    )
  })

  return byPosition
}
