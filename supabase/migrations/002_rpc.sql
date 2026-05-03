-- supabase/migrations/002_rpc.sql

CREATE OR REPLACE FUNCTION update_day_if_version(
  p_id uuid,
  p_expected_version int,
  p_changes jsonb,
  p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_version int;
  result_row days%ROWTYPE;
BEGIN
  SELECT version INTO current_version
  FROM days WHERE id = p_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF current_version != p_expected_version THEN
    SELECT * INTO result_row FROM days WHERE id = p_id;
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'conflict',
      'current', row_to_json(result_row)::jsonb
    );
  END IF;

  UPDATE days SET
    details = p_changes,
    version = version + 1,
    updated_by = p_actor,
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO result_row;

  RETURN jsonb_build_object('ok', true, 'row', row_to_json(result_row)::jsonb);
END;
$$;
