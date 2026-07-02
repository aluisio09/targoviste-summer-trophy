export interface Category {
  id: string
  name: string
  year: number
  display_order: number
  group_stage_complete: boolean
  created_at: string
}

export interface Group {
  id: string
  category_id: string
  name: string
  display_order: number
  created_at: string
  teams?: Team[]
  matches?: GroupMatch[]
}

export interface Team {
  id: string
  name: string
  short_name: string | null
  group_id: string
  category_id: string
  created_at: string
  group?: Group
}

export interface GroupMatch {
  id: string
  group_id: string
  category_id: string
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'live' | 'finished'
  scheduled_time: string | null
  match_number: number | null
  created_at: string
  home_team?: Team
  away_team?: Team
  group?: Group
}

export interface Bracket {
  id: string
  category_id: string
  name: string
  position_start: number
  position_end: number
  teams_count: number
  status: 'pending' | 'active' | 'completed'
  created_at: string
  matches?: BracketMatch[]
}

export interface BracketMatch {
  id: string
  bracket_id: string
  category_id: string
  round_number: number
  match_order: number
  round_name: string
  home_team_id: string | null
  away_team_id: string | null
  home_score: number | null
  away_score: number | null
  winner_id: string | null
  status: 'pending' | 'scheduled' | 'live' | 'finished' | 'bye'
  scheduled_time: string | null
  winner_next_match_id: string | null
  winner_next_slot: 'home' | 'away' | null
  loser_next_match_id: string | null
  loser_next_slot: 'home' | 'away' | null
  created_at: string
  home_team?: Team
  away_team?: Team
  winner?: Team
}

export interface TeamStanding {
  team: Team
  position: number
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
}
