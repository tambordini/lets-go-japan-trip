-- supabase/migrations/006_update_days_rpc.sql

-- Add editor tracking columns
ALTER TABLE days
  ADD COLUMN IF NOT EXISTS last_editor_name text,
  ADD COLUMN IF NOT EXISTS last_editor_at   timestamptz;

-- Drop old function (signature: uuid, int, jsonb, uuid)
DROP FUNCTION IF EXISTS update_day_if_version(uuid, integer, jsonb, uuid);

-- Recreate with new signature (p_actor is now text, add p_actor_at)
CREATE OR REPLACE FUNCTION update_day_if_version(
  p_id               uuid,
  p_expected_version int,
  p_changes          jsonb,
  p_actor            text DEFAULT NULL,
  p_actor_at         text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_version int;
  v_row             days;
BEGIN
  SELECT version INTO v_current_version
    FROM days WHERE id = p_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_current_version != p_expected_version THEN
    SELECT * INTO v_row FROM days WHERE id = p_id;
    RETURN jsonb_build_object(
      'ok',      false,
      'error',   'conflict',
      'current', row_to_json(v_row)::jsonb
    );
  END IF;

  UPDATE days
  SET
    details          = p_changes,
    version          = version + 1,
    updated_at       = now(),
    last_editor_name = CASE WHEN p_actor IS NOT NULL THEN p_actor ELSE last_editor_name END,
    last_editor_at   = CASE WHEN p_actor IS NOT NULL THEN p_actor_at::timestamptz ELSE last_editor_at END
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'row', row_to_json(v_row)::jsonb);
END;
$$;

-- Re-grant to anon (dropped alongside the old function)
GRANT EXECUTE ON FUNCTION update_day_if_version(uuid, int, jsonb, text, text) TO anon;
