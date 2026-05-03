-- supabase/seed.sql
-- NOTE: Run this via Supabase SQL Editor while logged in (RLS requires auth.uid())

INSERT INTO itineraries (id, owner, title)
VALUES (
  'b8f5e2a1-0000-4000-8000-000000000001',
  auth.uid(),
  'Japan Trip 2026'
);

INSERT INTO days (itinerary_id, day_index, title, details) VALUES
('b8f5e2a1-0000-4000-8000-000000000001', 1, 'Tokyo (Day 1)',
  '{"place":"Tokyo","jp":"\u6771\u4eac","lat":35.6762,"lng":139.6503,"acts":["\u0e16\u0e36\u0e07\u0e0d\u0e35\u0e48\u0e1b\u0e38\u0e48\u0e19 \u2708","\u0e40\u0e0a\u0e47\u0e04\u0e2d\u0e34\u0e19\u0e42\u0e23\u0e07\u0e41\u0e23\u0e21","\u0e40\u0e14\u0e34\u0e19\u0e40\u0e25\u0e48\u0e19\u0e2a\u0e33\u0e23\u0e27\u0e08\u0e23\u0e2d\u0e1a\u0e46"],"badges":[{"label":"Arrival","cls":"city"}],"travel":null}'::jsonb),
('b8f5e2a1-0000-4000-8000-000000000001', 2, 'Kamakura',
  '{"place":"Kamakura","jp":"\u9e0c\u5009","lat":35.3192,"lng":139.5467,"acts":["\u0e1e\u0e23\u0e30\u0e43\u0e2b\u0e0d\u0e48 Kotoku-in","Hase-dera Temple","Komachi-dori \u0e0a\u0e49\u0e2d\u0e1b\u0e1b\u0e34\u0e49\u0e07"],"badges":[{"label":"Temple","cls":"nature"},{"label":"Culture","cls":""}],"travel":{"icon":"\ud83d\ude83","time":"~1.5 \u0e0a\u0e21."}}'::jsonb),
('b8f5e2a1-0000-4000-8000-000000000001', 3, 'Tokyo Disneyland',
  '{"place":"Tokyo Disneyland","jp":"\u30c7\u30a3\u30ba\u30cb\u30fc\u30e9\u30f3\u30c9","lat":35.6329,"lng":139.8804,"acts":["\u0e2a\u0e27\u0e19\u0e2a\u0e19\u0e38\u0e01\u0e40\u0e15\u0e47\u0e21\u0e27\u0e31\u0e19 \ud83c\udfa2","Parades & Shows","Disney magic!"],"badges":[{"label":"Theme Park","cls":"fun"}],"travel":{"icon":"\ud83d\ude83","time":"~40 \u0e19\u0e32\u0e17\u0e35"}}'::jsonb),
('b8f5e2a1-0000-4000-8000-000000000001', 4, 'Mt. Fuji',
  '{"place":"Mt. Fuji","jp":"\u5bcc\u58eb\u5c71","lat":35.4600,"lng":138.7274,"acts":["Kawaguchiko \u0e17\u0e30\u0e40\u0e25\u0e2a\u0e32\u0e1a","Chureito Pagoda","Oshino Hakkai"],"badges":[{"label":"Nature","cls":"nature"},{"label":"Iconic","cls":""}],"travel":{"icon":"\ud83d\ude97","time":"~2.5 \u0e0a\u0e21."}}'::jsonb),
('b8f5e2a1-0000-4000-8000-000000000001', 5, 'Matsumoto to Hakuba',
  '{"place":"Matsumoto \u2192 Hakuba","jp":"\u677e\u672c\u57ce \u2192 \u767d\u99ac","lat":36.2389,"lng":137.9681,"acts":["Matsumoto Castle \ud83c\udfef","\u0e02\u0e31\u0e1a\u0e1c\u0e48\u0e32\u0e19\u0e40\u0e17\u0e37\u0e2d\u0e01\u0e40\u0e02\u0e32\u0e41\u0e2d\u0e25\u0e4c\u0e1b\u0e4c","\u0e40\u0e0a\u0e47\u0e04\u0e2d\u0e34\u0e19 Hakuba"],"badges":[{"label":"Castle","cls":""},{"label":"Scenic Drive","cls":"snow"}],"travel":{"icon":"\ud83d\ude97","time":"~4.5-5 \u0e0a\u0e21."}}'::jsonb),
('b8f5e2a1-0000-4000-8000-000000000001', 6, 'Hakuba Ski Day',
  '{"place":"Hakuba","jp":"\u767d\u99ac","lat":36.6989,"lng":137.8670,"acts":["\u0e40\u0e25\u0e48\u0e19\u0e2a\u0e01\u0e35\u0e40\u0e15\u0e47\u0e21\u0e27\u0e31\u0e19 \u26f7","\u0e2d\u0e2d\u0e19\u0e40\u0e0b\u0e47\u0e19\u0e22\u0e32\u0e21\u0e40\u0e22\u0e47\u0e19 \u2668","\u0e1e\u0e31\u0e01\u0e1c\u0e48\u0e2d\u0e19\u0e17\u0e48\u0e32\u0e21\u0e01\u0e25\u0e32\u0e07\u0e2b\u0e34\u0e21\u0e30"],"badges":[{"label":"Skiing","cls":"snow"},{"label":"Onsen","cls":"nature"}],"travel":null}'::jsonb),
('b8f5e2a1-0000-4000-8000-000000000001', 7, 'Hakuba to Tokyo',
  '{"place":"Hakuba \u2192 Tokyo","jp":"\u5e30\u308a\u9053","lat":36.10,"lng":138.40,"acts":["\u0e04\u0e37\u0e19\u0e23\u0e16\u0e40\u0e0a\u0e48\u0e32","\u0e02\u0e31\u0e1a\u0e23\u0e16\u0e01\u0e25\u0e31\u0e1a Tokyo \u0e22\u0e32\u0e21\u0e04\u0e48\u0e33","\u0e1a\u0e2d\u0e01\u0e25\u0e32\u0e2b\u0e34\u0e21\u0e30 \ud83c\udf19"],"badges":[{"label":"Night Drive","cls":"snow"}],"travel":{"icon":"\ud83d\ude97","time":"~4.5-5 \u0e0a\u0e21."}}'::jsonb),
('b8f5e2a1-0000-4000-8000-000000000001', 8, 'Tokyo Last Day',
  '{"place":"Tokyo","jp":"\u6771\u4eac","lat":35.6896,"lng":139.7023,"acts":["\u0e0a\u0e49\u0e2d\u0e1b\u0e1b\u0e34\u0e49\u0e07\u0e27\u0e31\u0e19\u0e2a\u0e38\u0e14\u0e17\u0e49\u0e32\u0e22 \ud83d\uded2","Illumination \u0e22\u0e32\u0e21\u0e04\u0e48\u0e33 \u2728","See you again, Japan \ud83c\uddef\ud83c\uddf5"],"badges":[{"label":"Shopping","cls":"city"},{"label":"Night Out","cls":""}],"travel":null}'::jsonb);
