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

// Photon geocoding — free, no API key
async function searchPlaceName(query) {
  if (!query || query.trim().length < 2) return [];
  const url = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(query) + '&limit=5&lang=ja';
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const geo = await res.json();
    return (geo.features || []).map(f => ({
      name: f.properties.name || '',
      label: f.properties.name + (f.properties.city ? ', ' + f.properties.city : '') + (f.properties.country ? ', ' + f.properties.country : ''),
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }));
  } catch {
    return [];
  }
}
