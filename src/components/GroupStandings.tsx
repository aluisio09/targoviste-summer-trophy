import type { TeamStanding } from '@/types'

interface Props {
  standings: TeamStanding[]
  groupName: string
}

export function GroupStandings({ standings, groupName }: Props) {
  return (
    <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
      <div className="bg-[#0f3d1f] px-4 py-2">
        <h3 className="text-white font-bold text-sm">{groupName}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="px-3 py-2 text-left w-6">#</th>
              <th className="px-3 py-2 text-left">Echipă</th>
              <th className="px-3 py-2 text-center">J</th>
              <th className="px-3 py-2 text-center">V</th>
              <th className="px-3 py-2 text-center">E</th>
              <th className="px-3 py-2 text-center">I</th>
              <th className="px-3 py-2 text-center">GM</th>
              <th className="px-3 py-2 text-center">GP</th>
              <th className="px-3 py-2 text-center">Dif</th>
              <th className="px-3 py-2 text-center font-bold text-gray-700">Pct</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, idx) => (
              <tr
                key={s.team.id}
                className={`border-t border-gray-100 ${idx === 0 ? 'bg-green-50' : ''}`}
              >
                <td className="px-3 py-2 text-center text-gray-400 font-medium">{idx + 1}</td>
                <td className="px-3 py-2 font-semibold text-gray-800">{s.team.name}</td>
                <td className="px-3 py-2 text-center text-gray-600">{s.played}</td>
                <td className="px-3 py-2 text-center text-green-600 font-medium">{s.won}</td>
                <td className="px-3 py-2 text-center text-gray-500">{s.drawn}</td>
                <td className="px-3 py-2 text-center text-red-500">{s.lost}</td>
                <td className="px-3 py-2 text-center text-gray-600">{s.goals_for}</td>
                <td className="px-3 py-2 text-center text-gray-600">{s.goals_against}</td>
                <td className="px-3 py-2 text-center text-gray-600">
                  {s.goal_difference > 0 ? `+${s.goal_difference}` : s.goal_difference}
                </td>
                <td className="px-3 py-2 text-center font-bold text-gray-900">{s.points}</td>
              </tr>
            ))}
            {standings.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-gray-400 text-xs">
                  Nu există echipe în această grupă
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
