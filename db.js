// db.js
const { createClient } = supabase;
const db = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

async function loadDays() {
  const { data, error } = await db
    .from('days')
    .select('*')
    .eq('itinerary_id', window.TRIP_ITINERARY_ID)
    .order('day_index', { ascending: true });
  if (error) throw error;
  return data;
}

async function loadMembers() {
  const { data, error } = await db
    .from('trip_members')
    .select('id, name')
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}
