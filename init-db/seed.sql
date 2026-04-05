-- ─────────────────────────────────────────────────────────────────────────────
-- seed.sql  –  Mock data for MysteryBox
-- All test users have password: admin123
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT guards)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  -- items
  v_gold_coins       varchar;
  v_iron_shield      varchar;
  v_magic_potion     varchar;
  v_enchanted_bow    varchar;
  v_dragon_scale     varchar;
  v_shadow_cloak     varchar;
  v_phoenix_feather  varchar;
  v_void_crystal     varchar;

  -- boxes
  v_box_starter      varchar;
  v_box_adventure    varchar;
  v_box_epic         varchar;
  v_box_legendary    varchar;

  -- users
  v_veteran          varchar;
  v_player           varchar;
  v_newbie           varchar;
  v_creator          varchar;
  v_hunter           varchar;

  -- bcrypt hash for "admin123"
  v_pw  varchar := '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW';

BEGIN

-- ── Guard: skip if seed already applied ──────────────────────────────────────
IF EXISTS (SELECT 1 FROM item WHERE name = 'Gold Coins') THEN
  RAISE NOTICE 'Seed already applied – skipping.';
  RETURN;
END IF;

-- ─────────────────────────────────────────────────────────────────────────────
-- ITEMS
-- Rarity is computed from avg pull_probability across all boxes:
--   >= 50 → common  |  20-49 → rare  |  5-19 → epic  |  < 5 → legendary
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO item (name, points, description) VALUES
  ('Gold Coins',      5,   'A handful of shiny gold coins. Better than nothing.')
  RETURNING id INTO v_gold_coins;

INSERT INTO item (name, points, description) VALUES
  ('Iron Shield',     15,  'A sturdy iron shield. Blocks most basic attacks.')
  RETURNING id INTO v_iron_shield;

INSERT INTO item (name, points, description) VALUES
  ('Magic Potion',    25,  'A glowing blue potion. Restores 50 HP instantly.')
  RETURNING id INTO v_magic_potion;

INSERT INTO item (name, points, description) VALUES
  ('Enchanted Bow',   40,  'A bow infused with arcane energy. Fires magic arrows.')
  RETURNING id INTO v_enchanted_bow;

INSERT INTO item (name, points, description) VALUES
  ('Dragon Scale',    70,  'A scale shed by an ancient dragon. Almost indestructible.')
  RETURNING id INTO v_dragon_scale;

INSERT INTO item (name, points, description) VALUES
  ('Shadow Cloak',    90,  'A cloak woven from pure darkness. Grants near-invisibility.')
  RETURNING id INTO v_shadow_cloak;

INSERT INTO item (name, points, description) VALUES
  ('Phoenix Feather', 175, 'A feather from a legendary phoenix. Radiates warmth and hope.')
  RETURNING id INTO v_phoenix_feather;

INSERT INTO item (name, points, description) VALUES
  ('Void Crystal',    250, 'A crystal formed in the void dimension. Impossibly rare.')
  RETURNING id INTO v_void_crystal;

-- ─────────────────────────────────────────────────────────────────────────────
-- BOXES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO box (name, description, cost) VALUES
  ('Starter Crate',
   'Perfect for beginners. Contains common and rare loot at a low price.',
   50)
  RETURNING id INTO v_box_starter;

INSERT INTO box (name, description, cost) VALUES
  ('Adventure Pack',
   'A balanced box for seasoned explorers. Rare and epic items await.',
   200)
  RETURNING id INTO v_box_adventure;

INSERT INTO box (name, description, cost) VALUES
  ('Epic Chest',
   'Only the brave open this chest. Epic and legendary drops guaranteed.',
   500)
  RETURNING id INTO v_box_epic;

INSERT INTO box (name, description, cost) VALUES
  ('Legendary Vault',
   'The rarest box in existence. Dragons protect it for a reason.',
   1500)
  RETURNING id INTO v_box_legendary;

-- ─────────────────────────────────────────────────────────────────────────────
-- BOX → ITEM PROBABILITIES & STOCK
--
-- Resulting avg pull_probability per item:
--   Gold Coins      → Starter(70) + Adventure(50)          → avg 60  → COMMON
--   Iron Shield     → Starter(55)                          → avg 55  → COMMON
--   Magic Potion    → Starter(35) + Adventure(35)          → avg 35  → RARE
--   Enchanted Bow   → Adventure(25) + Epic(25)             → avg 25  → RARE
--   Dragon Scale    → Adventure(12) + Epic(12) + Vault(12) → avg 12  → EPIC
--   Shadow Cloak    → Epic(8)       + Vault(8)             → avg  8  → EPIC
--   Phoenix Feather → Epic(3)       + Vault(3)             → avg  3  → LEGENDARY
--   Void Crystal    → Vault(2)                             → avg  2  → LEGENDARY
-- ─────────────────────────────────────────────────────────────────────────────

-- Starter Crate
INSERT INTO box_to_item (box_id, item_id, pull_probability, stock) VALUES
  (v_box_starter, v_gold_coins,      70, 500),
  (v_box_starter, v_iron_shield,     55, 200),
  (v_box_starter, v_magic_potion,    35, 100);

-- Adventure Pack
INSERT INTO box_to_item (box_id, item_id, pull_probability, stock) VALUES
  (v_box_adventure, v_gold_coins,     50, 300),
  (v_box_adventure, v_magic_potion,   35, 120),
  (v_box_adventure, v_enchanted_bow,  25, 60),
  (v_box_adventure, v_dragon_scale,   12, 30);

-- Epic Chest
INSERT INTO box_to_item (box_id, item_id, pull_probability, stock) VALUES
  (v_box_epic, v_enchanted_bow,   25, 50),
  (v_box_epic, v_dragon_scale,    12, 25),
  (v_box_epic, v_shadow_cloak,     8, 20),
  (v_box_epic, v_phoenix_feather,  3, 10);

-- Legendary Vault
INSERT INTO box_to_item (box_id, item_id, pull_probability, stock) VALUES
  (v_box_legendary, v_dragon_scale,    12, 15),
  (v_box_legendary, v_shadow_cloak,     8, 10),
  (v_box_legendary, v_phoenix_feather,  3,  8),
  (v_box_legendary, v_void_crystal,     2,  4);

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS  (password for all: admin123)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "user" (mail, password, role, deposit, score) VALUES
  ('veteran@test.com', v_pw, 'user',    8500, 4200)
  RETURNING id INTO v_veteran;

INSERT INTO "user" (mail, password, role, deposit, score) VALUES
  ('player@test.com',  v_pw, 'user',    2800, 1150)
  RETURNING id INTO v_player;

INSERT INTO "user" (mail, password, role, deposit, score) VALUES
  ('newbie@test.com',  v_pw, 'user',     300,   85)
  RETURNING id INTO v_newbie;

INSERT INTO "user" (mail, password, role, deposit, score) VALUES
  ('creator@test.com', v_pw, 'creator', 15000, 6800)
  RETURNING id INTO v_creator;

INSERT INTO "user" (mail, password, role, deposit, score) VALUES
  ('hunter@test.com',  v_pw, 'user',    1200, 2100)
  RETURNING id INTO v_hunter;

-- ─────────────────────────────────────────────────────────────────────────────
-- INVENTORY (user_items)
-- ─────────────────────────────────────────────────────────────────────────────

-- veteran: has opened lots of boxes, has rare/epic items
INSERT INTO user_items (user_id, item_id, box_id, count) VALUES
  (v_veteran, v_gold_coins,      v_box_starter,   12),
  (v_veteran, v_iron_shield,     v_box_starter,    4),
  (v_veteran, v_magic_potion,    v_box_adventure,  6),
  (v_veteran, v_enchanted_bow,   v_box_adventure,  3),
  (v_veteran, v_dragon_scale,    v_box_epic,       2),
  (v_veteran, v_shadow_cloak,    v_box_epic,       1),
  (v_veteran, v_phoenix_feather, v_box_epic,       1);

-- player: mid-level inventory
INSERT INTO user_items (user_id, item_id, box_id, count) VALUES
  (v_player, v_gold_coins,    v_box_starter,   5),
  (v_player, v_iron_shield,   v_box_starter,   2),
  (v_player, v_magic_potion,  v_box_adventure, 3),
  (v_player, v_enchanted_bow, v_box_adventure, 1);

-- newbie: barely started
INSERT INTO user_items (user_id, item_id, box_id, count) VALUES
  (v_newbie, v_gold_coins,  v_box_starter, 2),
  (v_newbie, v_iron_shield, v_box_starter, 1);

-- hunter: grinds aggressively, has legendary items
INSERT INTO user_items (user_id, item_id, box_id, count) VALUES
  (v_hunter, v_gold_coins,      v_box_starter,    8),
  (v_hunter, v_magic_potion,    v_box_adventure,  4),
  (v_hunter, v_enchanted_bow,   v_box_adventure,  2),
  (v_hunter, v_dragon_scale,    v_box_epic,       3),
  (v_hunter, v_shadow_cloak,    v_box_legendary,  1),
  (v_hunter, v_phoenix_feather, v_box_legendary,  1),
  (v_hunter, v_void_crystal,    v_box_legendary,  1);

-- ─────────────────────────────────────────────────────────────────────────────
-- ORDER HISTORY
-- ─────────────────────────────────────────────────────────────────────────────

-- veteran – extensive history over the past month
INSERT INTO "order" (user_id, box_id, item_id, amount, status, created_at) VALUES
  (v_veteran, v_box_starter,   v_gold_coins,      50,  'completed', NOW() - INTERVAL '28 days'),
  (v_veteran, v_box_starter,   v_iron_shield,     50,  'completed', NOW() - INTERVAL '27 days'),
  (v_veteran, v_box_starter,   v_magic_potion,    50,  'completed', NOW() - INTERVAL '26 days'),
  (v_veteran, v_box_adventure, v_magic_potion,    200, 'completed', NOW() - INTERVAL '20 days'),
  (v_veteran, v_box_adventure, v_enchanted_bow,   200, 'completed', NOW() - INTERVAL '18 days'),
  (v_veteran, v_box_adventure, v_dragon_scale,    200, 'completed', NOW() - INTERVAL '15 days'),
  (v_veteran, v_box_epic,      v_enchanted_bow,   500, 'completed', NOW() - INTERVAL '10 days'),
  (v_veteran, v_box_epic,      v_dragon_scale,    500, 'completed', NOW() - INTERVAL '8 days'),
  (v_veteran, v_box_epic,      v_shadow_cloak,    500, 'completed', NOW() - INTERVAL '5 days'),
  (v_veteran, v_box_epic,      v_phoenix_feather, 500, 'completed', NOW() - INTERVAL '2 days'),
  (v_veteran, v_box_starter,   v_gold_coins,      50,  'completed', NOW() - INTERVAL '1 day');

-- player – moderate history
INSERT INTO "order" (user_id, box_id, item_id, amount, status, created_at) VALUES
  (v_player, v_box_starter,   v_gold_coins,    50,  'completed', NOW() - INTERVAL '14 days'),
  (v_player, v_box_starter,   v_iron_shield,   50,  'completed', NOW() - INTERVAL '12 days'),
  (v_player, v_box_adventure, v_magic_potion,  200, 'completed', NOW() - INTERVAL '7 days'),
  (v_player, v_box_adventure, v_enchanted_bow, 200, 'completed', NOW() - INTERVAL '3 days'),
  (v_player, v_box_starter,   v_gold_coins,    50,  'completed', NOW() - INTERVAL '1 day');

-- newbie – just started
INSERT INTO "order" (user_id, box_id, item_id, amount, status, created_at) VALUES
  (v_newbie, v_box_starter, v_gold_coins,  50, 'completed', NOW() - INTERVAL '3 days'),
  (v_newbie, v_box_starter, v_iron_shield, 50, 'completed', NOW() - INTERVAL '1 day');

-- hunter – lots of high-value opens
INSERT INTO "order" (user_id, box_id, item_id, amount, status, created_at) VALUES
  (v_hunter, v_box_starter,   v_gold_coins,      50,   'completed', NOW() - INTERVAL '45 days'),
  (v_hunter, v_box_starter,   v_magic_potion,    50,   'completed', NOW() - INTERVAL '40 days'),
  (v_hunter, v_box_adventure, v_enchanted_bow,   200,  'completed', NOW() - INTERVAL '35 days'),
  (v_hunter, v_box_adventure, v_dragon_scale,    200,  'completed', NOW() - INTERVAL '30 days'),
  (v_hunter, v_box_epic,      v_dragon_scale,    500,  'completed', NOW() - INTERVAL '25 days'),
  (v_hunter, v_box_epic,      v_shadow_cloak,    500,  'completed', NOW() - INTERVAL '20 days'),
  (v_hunter, v_box_legendary, v_dragon_scale,    1500, 'completed', NOW() - INTERVAL '15 days'),
  (v_hunter, v_box_legendary, v_phoenix_feather, 1500, 'completed', NOW() - INTERVAL '10 days'),
  (v_hunter, v_box_legendary, v_void_crystal,    1500, 'completed', NOW() - INTERVAL '5 days'),
  (v_hunter, v_box_legendary, v_shadow_cloak,    1500, 'completed', NOW() - INTERVAL '2 days');

RAISE NOTICE 'Seed applied successfully.';
END $$;
