import type { Team, TeamStanding } from '@/types'
import { createServiceClient } from '@/lib/supabase/server'

// Tournament bracket seeding: ensures top seeds meet as late as possible
function buildSeedOrder(n: number): number[] {
  if (n <= 1) return [1]
  if (n === 2) return [1, 2]
  const half = n / 2
  const top = buildSeedOrder(half)
  const bottom = top.map((s) => n + 1 - s)
  const result: number[] = []
  for (let i = 0; i < half; i++) {
    result.push(top[i], bottom[i])
  }
  return result
}

function nextPow2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(n, 2))))
}

function getRoundName(round: number, totalRounds: number): string {
  const remaining = totalRounds - round + 1
  if (remaining === 1) return 'Finala'
  if (remaining === 2) return 'Semifinala'
  if (remaining === 3) return 'Sfert de finala'
  return `Turul ${round}`
}

interface MatchInsert {
  bracket_id: string
  category_id: string
  round_number: number
  match_order: number
  round_name: string
  home_team_id: string | null
  away_team_id: string | null
  status: string
}

export async function generateBracketMatches(
  bracketId: string,
  categoryId: string,
  seededTeams: TeamStanding[] // already in seed order
): Promise<void> {
  const supabase = createServiceClient()
  const n = seededTeams.length
  const bracketSize = nextPow2(n)
  const totalRounds = Math.log2(bracketSize)

  // Pad with nulls for byes
  const padded: (TeamStanding | null)[] = [...seededTeams]
  while (padded.length < bracketSize) padded.push(null)

  // Apply bracket seeding order
  const seedOrder = buildSeedOrder(bracketSize)
  const arranged = seedOrder.map((seed) => padded[seed - 1] ?? null)

  // --- INSERT ALL MATCHES FIRST (get their IDs) ---
  // Round 1
  const r1Inserts: MatchInsert[] = []
  for (let i = 0; i < bracketSize / 2; i++) {
    const home = arranged[i * 2]
    const away = arranged[i * 2 + 1]
    const isBye = !home || !away
    r1Inserts.push({
      bracket_id: bracketId,
      category_id: categoryId,
      round_number: 1,
      match_order: i,
      round_name: totalRounds === 1 ? 'Finala' : getRoundName(1, totalRounds),
      home_team_id: home?.team.id ?? null,
      away_team_id: away?.team.id ?? null,
      status: isBye ? 'bye' : 'scheduled',
    })
  }

  const { data: round1Matches, error: e1 } = await supabase
    .from('bracket_matches')
    .insert(r1Inserts)
    .select()
  if (e1) throw e1

  // Remaining rounds
  const allRounds: typeof round1Matches[] = [round1Matches]
  let matchesInRound = bracketSize / 2

  for (let round = 2; round <= totalRounds; round++) {
    matchesInRound = matchesInRound / 2
    const inserts: MatchInsert[] = []
    for (let i = 0; i < matchesInRound; i++) {
      inserts.push({
        bracket_id: bracketId,
        category_id: categoryId,
        round_number: round,
        match_order: i,
        round_name: getRoundName(round, totalRounds),
        home_team_id: null,
        away_team_id: null,
        status: 'pending',
      })
    }
    // 3rd place match alongside the final
    if (round === totalRounds && totalRounds > 1) {
      inserts.push({
        bracket_id: bracketId,
        category_id: categoryId,
        round_number: round,
        match_order: matchesInRound,
        round_name: 'Finala mica',
        home_team_id: null,
        away_team_id: null,
        status: 'pending',
      })
    }
    const { data: roundMatches, error } = await supabase
      .from('bracket_matches')
      .insert(inserts)
      .select()
    if (error) throw error
    allRounds.push(roundMatches)
  }

  // --- LINK ADVANCEMENT ---
  for (let ri = 0; ri < allRounds.length - 1; ri++) {
    const currentRound = allRounds[ri]!
    const nextRound = allRounds[ri + 1]!
    const roundNumber = ri + 1
    const isSemiFinal = roundNumber === totalRounds - 1

    const finalRound = allRounds[allRounds.length - 1]!
    const thirdPlaceMatch = finalRound[finalRound.length - 1]

    for (let i = 0; i < currentRound.length; i++) {
      const match = currentRound[i]
      const nextMatchIdx = Math.floor(i / 2)
      const slot: 'home' | 'away' = i % 2 === 0 ? 'home' : 'away'
      const winnerNext = nextRound[nextMatchIdx]

      await supabase
        .from('bracket_matches')
        .update({
          winner_next_match_id: winnerNext?.id ?? null,
          winner_next_slot: slot,
          loser_next_match_id:
            isSemiFinal && totalRounds > 1 ? thirdPlaceMatch?.id ?? null : null,
          loser_next_slot:
            isSemiFinal && totalRounds > 1 ? slot : null,
        })
        .eq('id', match.id)
    }
  }

  // Handle byes: auto-advance the present team
  for (const match of round1Matches!) {
    if (match.status !== 'bye') continue
    const winnerId = match.home_team_id ?? match.away_team_id
    if (!winnerId) continue
    await supabase
      .from('bracket_matches')
      .update({ winner_id: winnerId, status: 'finished' })
      .eq('id', match.id)
    if (match.winner_next_match_id) {
      await supabase
        .from('bracket_matches')
        .update({ [`${match.winner_next_slot}_team_id`]: winnerId })
        .eq('id', match.winner_next_match_id)
    }
  }
}
