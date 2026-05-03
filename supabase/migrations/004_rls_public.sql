-- Drop auth-required policies
DROP POLICY IF EXISTS "days_select" ON days;
DROP POLICY IF EXISTS "days_insert" ON days;
DROP POLICY IF EXISTS "days_update" ON days;
DROP POLICY IF EXISTS "itineraries_select" ON itineraries;
DROP POLICY IF EXISTS "itineraries_insert" ON itineraries;
DROP POLICY IF EXISTS "itineraries_delete" ON itineraries;

-- Allow anyone (anon) to read/write days
CREATE POLICY "days_select_public" ON days FOR SELECT USING (true);
CREATE POLICY "days_insert_public" ON days FOR INSERT WITH CHECK (true);
CREATE POLICY "days_update_public" ON days FOR UPDATE USING (true);

-- Allow anyone to read itineraries
CREATE POLICY "itineraries_select_public" ON itineraries FOR SELECT USING (true);

-- Allow anon to call the RPC
GRANT EXECUTE ON FUNCTION update_day_if_version TO anon;
