-- supabase/migrations/003_rls.sql

ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE days ENABLE ROW LEVEL SECURITY;

-- itineraries: authenticated users can read; only owner can insert/delete
CREATE POLICY "itineraries_select" ON itineraries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "itineraries_insert" ON itineraries
  FOR INSERT TO authenticated WITH CHECK (owner = auth.uid());

CREATE POLICY "itineraries_delete" ON itineraries
  FOR DELETE TO authenticated USING (owner = auth.uid());

-- days: all authenticated users can read/insert/update (group trip)
CREATE POLICY "days_select" ON days
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "days_insert" ON days
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "days_update" ON days
  FOR UPDATE TO authenticated USING (true);
