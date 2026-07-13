import type { GroupMatch, BracketMatch } from '@/types'

const MONTHS = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sep.', 'oct.', 'nov.', 'dec.']

function formatSchedule(date: string | null, time: string | null): string | null {
  if (!date && !time) return null
  let result = ''
  if (date) {
    const [, m, d] = date.split('-')
    result += `${parseInt(d)} ${MONTHS[parseInt(m) - 1]}`
  }
  if (time) {
    if (result) result += ' · '
    result += time.substring(0, 5)
  }
  return result
}

interface GroupMatchCardProps {
  match: GroupMatch
}

export function GroupMatchCard({ match }: GroupMatchCardProps) {
  const isLive = match.status === 'live'
  const isFinished = match.status === 'finished'
  const schedule = formatSchedule(match.scheduled_date ?? null, match.scheduled_time ?? null)

  return (
    <div className={`rounded-lg text-sm overflow-hidden ${
      isLive ? 'bg-red-50 border border-red-200' : 'bg-white border border-gray-100'
    }`}>
      {schedule && !isLive && (
        <div className="text-[11px] text-gray-400 text-center py-1 px-3 bg-gray-50 border-b border-gray-100">
          📅 {schedule}
        </div>
      )}
      <div className="flex items-center gap-2 py-2 px-3">
        {isLive && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-bold shrink-0">
            <span className="live-dot w-2 h-2 rounded-full bg-red-500 inline-block" />
            AO VIVO
          </span>
        )}
        <span className="flex-1 text-right font-semibold text-gray-800 truncate">
          {match.home_team?.name ?? '—'}
        </span>
        <span className={`shrink-0 font-bold text-base px-2 py-0.5 rounded min-w-[52px] text-center ${
          isFinished || isLive
            ? 'bg-gray-800 text-white'
            : 'bg-gray-100 text-gray-400'
        }`}>
          {isFinished || isLive
            ? `${match.home_score ?? 0} - ${match.away_score ?? 0}`
            : 'vs'}
        </span>
        <span className="flex-1 font-semibold text-gray-800 truncate">
          {match.away_team?.name ?? '—'}
        </span>
      </div>
    </div>
  )
}

interface BracketMatchCardProps {
  match: BracketMatch
  compact?: boolean
}

export function BracketMatchCard({ match, compact }: BracketMatchCardProps) {
  const isLive = match.status === 'live'
  const isFinished = match.status === 'finished'
  const homeName = match.home_team?.name ?? 'TBD'
  const awayName = match.away_team?.name ?? 'TBD'
  const homeWon = isFinished && match.winner_id === match.home_team_id
  const awayWon = isFinished && match.winner_id === match.away_team_id
  const schedule = formatSchedule(match.scheduled_date ?? null, match.scheduled_time ?? null)

  if (compact) {
    return (
      <div className={`border rounded-lg overflow-hidden text-xs ${
        isLive ? 'border-red-300' : 'border-gray-200'
      } bg-white min-w-[160px]`}>
        {isLive && (
          <div className="bg-red-500 text-white text-center py-0.5 text-[10px] font-bold tracking-wide">
            🔴 LIVE
          </div>
        )}
        {schedule && !isLive && (
          <div className="bg-gray-50 text-[10px] text-gray-400 text-center py-0.5 border-b border-gray-100">
            📅 {schedule}
          </div>
        )}
        <div className={`flex items-center justify-between px-2 py-1.5 gap-2 ${homeWon ? 'bg-green-50' : ''}`}>
          <span className={`font-semibold truncate max-w-[90px] ${homeWon ? 'text-green-700' : 'text-gray-700'}`}>
            {homeName}
          </span>
          <span className={`font-bold shrink-0 ${isFinished || isLive ? 'text-gray-900' : 'text-gray-300'}`}>
            {isFinished || isLive ? (match.home_score ?? 0) : '-'}
          </span>
        </div>
        <div className="border-t border-gray-100" />
        <div className={`flex items-center justify-between px-2 py-1.5 gap-2 ${awayWon ? 'bg-green-50' : ''}`}>
          <span className={`font-semibold truncate max-w-[90px] ${awayWon ? 'text-green-700' : 'text-gray-700'}`}>
            {awayName}
          </span>
          <span className={`font-bold shrink-0 ${isFinished || isLive ? 'text-gray-900' : 'text-gray-300'}`}>
            {isFinished || isLive ? (match.away_score ?? 0) : '-'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${isLive ? 'border-red-300 shadow-red-100 shadow' : 'border-gray-200'} bg-white`}>
      {isLive && (
        <div className="bg-red-500 text-white text-center py-1 text-xs font-bold">🔴 LIVE</div>
      )}
      {schedule && !isLive && (
        <div className="bg-gray-50 text-[11px] text-gray-400 text-center py-1 border-b border-gray-100">
          📅 {schedule}
        </div>
      )}
      <div className={`flex items-center gap-3 px-4 py-2 ${homeWon ? 'bg-green-50' : ''}`}>
        <span className={`flex-1 font-semibold ${homeWon ? 'text-green-700' : 'text-gray-800'}`}>{homeName}</span>
        <span className="font-bold text-lg w-6 text-center">{isFinished || isLive ? (match.home_score ?? 0) : '-'}</span>
      </div>
      <div className="border-t border-gray-100" />
      <div className={`flex items-center gap-3 px-4 py-2 ${awayWon ? 'bg-green-50' : ''}`}>
        <span className={`flex-1 font-semibold ${awayWon ? 'text-green-700' : 'text-gray-800'}`}>{awayName}</span>
        <span className="font-bold text-lg w-6 text-center">{isFinished || isLive ? (match.away_score ?? 0) : '-'}</span>
      </div>
    </div>
  )
}
