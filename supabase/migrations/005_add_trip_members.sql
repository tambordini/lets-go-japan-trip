-- supabase/migrations/005_add_trip_members.sql

CREATE TABLE trip_members (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);

INSERT INTO trip_members (name) VALUES
  ('ต้น'), ('แมว'), ('บอส'), ('ออก'),
  ('ต่าง'), ('มิ่ง'), ('จั่น'), ('ลี่'),
  ('เคน'), ('ไทย');

ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_members_select_public"
  ON trip_members FOR SELECT USING (true);
