import type { Bracket, BracketMatch } from '@/types'
import { BracketMatchCard } from './MatchCard'

interface Props {
  brackets: Bracket[]
}

function organizeBracketRounds(matches: BracketMatch[]) {
  const byRound = new Map<number, BracketMatch[]>()
  for (const m of matches) {
    if (!byRound.has(m.round_number)) byRound.set(m.round_number, [])
    byRound.get(m.round_number)!.push(m)
  }
  // Sort each round by match_order
  byRound.forEach((ms) => ms.sort((a, b) => a.match_order - b.match_order))
  return Array.from(byRound.entries()).sort(([a], [b]) => a - b)
}

function separateFinalAndThird(roundMatches: BracketMatch[]) {
  const final = roundMatches.find((m) => m.round_name === 'Finala')
  const third = roundMatches.find((m) => m.round_name === 'Finala mica')
  const others = roundMatches.filter(
    (m) => m.round_name !== 'Finala' && m.round_name !== 'Finala mica'
  )
  return { final, third, others }
}

function SingleBracket({ bracket }: { bracket: Bracket }) {
  const rounds = organizeBracketRounds(bracket.matches ?? [])
  const maxRound = rounds.length > 0 ? rounds[rounds.length - 1][0] : 0

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-[#0f3d1f] text-[#f0c040] font-bold text-sm px-4 py-1.5 rounded-full">
          {bracket.name}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          bracket.status === 'completed'
            ? 'bg-gray-200 text-gray-500'
            : bracket.status === 'active'
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-gray-100 text-gray-400'
        }`}>
          {bracket.status === 'completed' ? 'Finalizat' : bracket.status === 'active' ? 'În desfășurare' : 'În așteptare'}
        </span>
      </div>

      {rounds.length === 0 && (
        <p className="text-gray-400 text-sm italic">Bracket-ul va fi generat după faza grupelor.</p>
      )}

      {/* Bracket rounds */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-6 items-start min-w-max">
          {rounds.map(([roundNum, matches]) => {
            const { final, third, others } = separateFinalAndThird(matches)
            const isLastRound = roundNum === maxRound

            return (
              <div key={roundNum} className="flex flex-col gap-3">
                {/* Round header */}
                <div className="text-center text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 min-w-[160px]">
                  {others[0]?.round_name ??
                    (isLastRound ? 'Finale' : `Runda ${roundNum}`)}
                </div>

                {/* Regular matches */}
                <div className={`flex flex-col ${isLastRound ? 'gap-4' : 'gap-3 justify-around flex-1'}`}>
                  {others.map((m) => (
                    <BracketMatchCard key={m.id} match={m} compact />
                  ))}

                  {isLastRound && final && (
                    <div>
                      <div className="text-center text-xs font-bold text-[#d4a017] mb-1 uppercase">Finala Mare</div>
                      <BracketMatchCard match={final} compact />
                    </div>
                  )}

                  {isLastRound && third && (
                    <div>
                      <div className="text-center text-xs font-bold text-gray-400 mb-1 uppercase">Finala Mică (Locul 3)</div>
                      <BracketMatchCard match={third} compact />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function BracketView({ brackets }: Props) {
  if (brackets.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-4xl mb-3">🏆</p>
        <p className="font-medium">Bracket-urile vor fi generate după faza grupelor.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {brackets.map((b) => (
        <SingleBracket key={b.id} bracket={b} />
      ))}
    </div>
  )
}
