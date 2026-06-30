-- supabase/migrations/007_add_day_places.sql

CREATE TABLE day_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid REFERENCES days(id) ON DELETE CASCADE,
  sort_index integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  acts jsonb DEFAULT '[]'::jsonb,
  expense numeric DEFAULT 0,
  split_among uuid[] DEFAULT '{}',
  lat numeric,
  lng numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE(day_id, sort_index)
);

-- RLS: anon can do everything (same as days table)
ALTER TABLE day_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_can_all_day_places"
  ON day_places FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- RPC: get places for a day
CREATE OR REPLACE FUNCTION get_day_places(p_day_id uuid)
RETURNS SETOF day_places
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM day_places WHERE day_id = p_day_id ORDER BY sort_index;
$$;

-- RPC: add a place
CREATE OR REPLACE FUNCTION add_day_place(
  p_day_id uuid,
  p_name text,
  p_acts jsonb DEFAULT '[]'::jsonb,
  p_expense numeric DEFAULT 0,
  p_split_among uuid[] DEFAULT '{}',
  p_lat numeric DEFAULT NULL,
  p_lng numeric DEFAULT NULL
) RETURNS day_places
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sort int;
  v_row day_places;
BEGIN
  SELECT COALESCE(MAX(sort_index), 0) + 1 INTO v_sort
    FROM day_places WHERE day_id = p_day_id;

  INSERT INTO day_places (day_id, sort_index, name, acts, expense, split_among, lat, lng)
  VALUES (p_day_id, v_sort, p_name, p_acts, p_expense, p_split_among, p_lat, p_lng)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- RPC: update a place
CREATE OR REPLACE FUNCTION update_day_place(
  p_id uuid,
  p_name text,
  p_acts jsonb DEFAULT '[]'::jsonb,
  p_expense numeric DEFAULT 0,
  p_split_among uuid[] DEFAULT '{}',
  p_lat numeric DEFAULT NULL,
  p_lng numeric DEFAULT NULL
) RETURNS day_places
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row day_places;
BEGIN
  UPDATE day_places SET
    name = p_name,
    acts = p_acts,
    expense = p_expense,
    split_among = p_split_among,
    lat = p_lat,
    lng = p_lng
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- RPC: delete a place
CREATE OR REPLACE FUNCTION delete_day_place(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM day_places WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_day_places(uuid) TO anon;
GRANT EXECUTE ON FUNCTION add_day_place(uuid, text, jsonb, numeric, uuid[], numeric, numeric) TO anon;
GRANT EXECUTE ON FUNCTION update_day_place(uuid, text, jsonb, numeric, uuid[], numeric, numeric) TO anon;
GRANT EXECUTE ON FUNCTION delete_day_place(uuid) TO anon;
