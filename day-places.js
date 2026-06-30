// day-places.js — CRUD for day_places + geocoding

async function loadDayPlaces(dayId) {
  if (!dayId) return [];
  const { data, error } = await db.rpc('get_day_places', { p_day_id: dayId });
  if (error) { console.error('loadDayPlaces error:', error); return []; }
  return data || [];
}

async function addPlace(dayId, data) {
  const { data: row, error } = await db.rpc('add_day_place', {
    p_day_id: dayId,
    p_name: data.name,
    p_acts: data.acts || [],
    p_expense: data.expense || 0,
    p_split_among: data.split_among || [],
    p_lat: data.lat || null,
    p_lng: data.lng || null,
  });
  if (error) throw error;
  return row;
}

async function updatePlace(id, data) {
  const { data: row, error } = await db.rpc('update_day_place', {
    p_id: id,
    p_name: data.name,
    p_acts: data.acts || [],
    p_expense: data.expense || 0,
    p_split_among: data.split_among || [],
    p_lat: data.lat || null,
    p_lng: data.lng || null,
  });
  if (error) throw error;
  return row;
}

async function deletePlace(id) {
  const { error } = await db.rpc('delete_day_place', { p_id: id });
  if (error) throw error;
}

// Nominatim geocoding — free, no API key, better Japan coverage
async function searchPlaceName(query) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const url = 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(q) + '&limit=5&format=json';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'LetsGoJapanTrip/1.0' } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map(f => ({
      name: f.display_name.split(',')[0],
      label: f.display_name,
      lat: parseFloat(f.lat),
      lng: parseFloat(f.lon),
    }));
  } catch {
    return [];
  }
}
