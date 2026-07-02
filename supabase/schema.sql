-- ============================================
-- Targoviste Summer Trophy - Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Categories (age groups 2012-2019)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  year INTEGER NOT NULL UNIQUE,
  display_order INTEGER NOT NULL,
  group_stage_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO categories (name, year, display_order) VALUES
  ('U7 (2019)', 2019, 1),
  ('U8 (2018)', 2018, 2),
  ('U9 (2017)', 2017, 3),
  ('U10 (2016)', 2016, 4),
  ('U11 (2015)', 2015, 5),
  ('U12 (2014)', 2014, 6),
  ('U13 (2013)', 2013, 7),
  ('U14 (2012)', 2012, 8)
ON CONFLICT (year) DO NOTHING;

-- Groups within categories (Grupa A, Grupa B, etc.)
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category_id, name)
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Group stage matches
CREATE TABLE IF NOT EXISTS group_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  home_team_id UUID NOT NULL REFERENCES teams(id),
  away_team_id UUID NOT NULL REFERENCES teams(id),
  home_score INTEGER,
  away_score INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'live', 'finished')),
  scheduled_time TIMESTAMPTZ,
  match_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Playoff brackets (one per position group: 1-4, 5-8, 9-12, 13-16)
CREATE TABLE IF NOT EXISTS brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,           -- 'Locurile 1-4', 'Locurile 5-8', etc.
  position_start INTEGER NOT NULL,  -- 1, 5, 9, 13...
  position_end INTEGER NOT NULL,    -- 4, 8, 12, 16...
  teams_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bracket matches (single-elimination with 3rd place match)
CREATE TABLE IF NOT EXISTS bracket_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bracket_id UUID NOT NULL REFERENCES brackets(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,      -- 1 = earliest (QF), increases toward final
  match_order INTEGER NOT NULL,       -- 0-indexed position within round
  round_name TEXT NOT NULL,           -- 'Sfert de finala', 'Semifinala', 'Finala', 'Finala mica'
  home_team_id UUID REFERENCES teams(id),
  away_team_id UUID REFERENCES teams(id),
  home_score INTEGER,
  away_score INTEGER,
  winner_id UUID REFERENCES teams(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scheduled', 'live', 'finished', 'bye')),
  scheduled_time TIMESTAMPTZ,
  winner_next_match_id UUID,    -- FK set after insert
  winner_next_slot TEXT CHECK (winner_next_slot IN ('home', 'away')),
  loser_next_match_id UUID,     -- only for SF matches → 3rd place
  loser_next_slot TEXT CHECK (loser_next_slot IN ('home', 'away')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Self-referential FKs for bracket advancement
ALTER TABLE bracket_matches
  ADD CONSTRAINT bm_winner_fk
    FOREIGN KEY (winner_next_match_id) REFERENCES bracket_matches(id),
  ADD CONSTRAINT bm_loser_fk
    FOREIGN KEY (loser_next_match_id) REFERENCES bracket_matches(id);

-- =====================
-- Row Level Security
-- =====================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_matches ENABLE ROW LEVEL SECURITY;

-- Public can read everything (live results)
CREATE POLICY "public_read" ON categories FOR SELECT USING (true);
CREATE POLICY "public_read" ON groups FOR SELECT USING (true);
CREATE POLICY "public_read" ON teams FOR SELECT USING (true);
CREATE POLICY "public_read" ON group_matches FOR SELECT USING (true);
CREATE POLICY "public_read" ON brackets FOR SELECT USING (true);
CREATE POLICY "public_read" ON bracket_matches FOR SELECT USING (true);

-- Admin writes via service_role key (bypasses RLS automatically)
-- No additional policies needed for service_role

-- =====================
-- Realtime (enable in Supabase dashboard → Database → Replication)
-- or run:
-- =====================
ALTER PUBLICATION supabase_realtime ADD TABLE group_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE bracket_matches;
