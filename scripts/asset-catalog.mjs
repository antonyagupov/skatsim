/**
 * Shared asset catalog for generation + placeholders.
 * Kept as plain JS so both Node scripts and the Vite app can share IDs via manifest.
 */

export const STYLE_FOUNDATION =
  "Original 16-bit fantasy JRPG pixel art for a browser game, compact readable silhouette, limited cohesive color palette, crisp hard pixel edges, no anti-aliasing, no text, no watermark, designed to remain readable at small gameplay size, original character and costume design";

/** @typedef {'transparent' | 'opaque'} BgMode */

/**
 * @typedef {object} AssetSpec
 * @property {string} id
 * @property {string} purpose
 * @property {number} width
 * @property {number} height
 * @property {BgMode} background
 * @property {string} prompt
 * @property {string} publicPath
 * @property {boolean} [skipByDefault]
 */

/** @type {AssetSpec[]} */
export const ASSET_SPECS = [
  {
    id: "battle-screen-ref",
    purpose: "Empty battle-screen environment backdrop (no characters)",
    width: 512,
    height: 288,
    background: "opaque",
    publicPath: "assets/refs/battle-screen-ref.png",
    prompt: `Original 16-bit fantasy JRPG pixel art for a browser game, late-SNES-era visual language, side-view empty battle arena backdrop only, layered dusk sky distant forested hills midground ruined stone pillars and grassy ground plane, open staging areas on left and right for sprites, limited cohesive fantasy teal-and-earth palette, crisp hard pixel edges, no anti-aliasing, no text, no watermark, no UI, absolutely no characters, no people, no heroes, no enemies, no creatures, no monsters, no silhouettes of fighters, empty scenic battlefield environment only`,
  },
  {
    id: "hero-warrior",
    purpose: "Red warrior battle sprite",
    width: 64,
    height: 64,
    background: "transparent",
    publicPath: "assets/heroes/hero-warrior.png",
    prompt: `${STYLE_FOUNDATION}, transparent background where applicable. Original 16-bit fantasy JRPG pixel-art battle sprite of a sturdy red-aligned warrior, three-quarter side view facing right, short sword and small round shield, broad readable silhouette, practical original armor with red cloth accents, confident neutral combat stance, limited cohesive palette, designed for a 64x64 gameplay sprite.`,
  },
  {
    id: "hero-mage",
    purpose: "Blue mage battle sprite",
    width: 64,
    height: 64,
    background: "transparent",
    publicPath: "assets/heroes/hero-mage.png",
    prompt: `${STYLE_FOUNDATION}, transparent background where applicable. Original 16-bit fantasy JRPG pixel-art battle sprite of a blue-aligned mage, side view facing right, lightweight layered robe, short staff with a simple ice crystal, intelligent restrained design, clear silhouette distinct from the warrior, limited blue and neutral palette, designed for a 64x64 gameplay sprite.`,
  },
  {
    id: "hero-ranger",
    purpose: "Green ranger battle sprite",
    width: 64,
    height: 64,
    background: "transparent",
    publicPath: "assets/heroes/hero-ranger.png",
    prompt: `${STYLE_FOUNDATION}, transparent background where applicable. Original 16-bit fantasy JRPG pixel-art battle sprite of a green-aligned ranger, side view facing right, compact bow, asymmetrical travel cloak, agile combat stance, readable silhouette at small scale, original fantasy costume, limited green and earthy palette, designed for a 64x64 gameplay sprite.`,
  },
  {
    id: "hero-priest",
    purpose: "Yellow priest battle sprite",
    width: 64,
    height: 64,
    background: "transparent",
    publicPath: "assets/heroes/hero-priest.png",
    prompt: `${STYLE_FOUNDATION}, transparent background where applicable. Original 16-bit fantasy JRPG pixel-art battle sprite of a yellow-aligned healer priest, side view facing right, small ceremonial staff, warm layered garments, calm supportive pose, distinctive readable silhouette, original fantasy design, limited gold cream and brown palette, designed for a 64x64 gameplay sprite.`,
  },
  {
    id: "enemy-slime",
    purpose: "Normal enemy slime",
    width: 64,
    height: 64,
    background: "transparent",
    publicPath: "assets/enemies/enemy-slime.png",
    prompt: `${STYLE_FOUNDATION}, transparent background where applicable. Original 16-bit fantasy JRPG pixel-art battle sprite of a small slime enemy, side view facing left, blob body with simple eyes, readable silhouette at 64x64, limited teal and purple palette, crisp hard pixel edges, no text, no watermark.`,
  },
  {
    id: "enemy-bat",
    purpose: "Normal enemy bat",
    width: 64,
    height: 64,
    background: "transparent",
    publicPath: "assets/enemies/enemy-bat.png",
    prompt: `${STYLE_FOUNDATION}, transparent background where applicable. Original 16-bit fantasy JRPG pixel-art battle sprite of a winged bat enemy, side view facing left, spread wings, compact body, readable silhouette at 64x64, limited brown and magenta palette, crisp hard pixel edges, no text, no watermark.`,
  },
  {
    id: "boss-goblin",
    purpose: "Goblin chieftain boss",
    width: 128,
    height: 128,
    background: "transparent",
    publicPath: "assets/enemies/boss-goblin.png",
    prompt: `${STYLE_FOUNDATION}, transparent background where applicable. Original 16-bit fantasy JRPG pixel-art boss sprite of a goblin chieftain, side view facing left, oversized patched armor, heavy cleaver, intimidating but slightly comedic proportions, strong readable silhouette, original creature design, limited earthy palette with one bright accent, designed for a 128x128 boss sprite.`,
  },
  {
    id: "gems-set",
    purpose: "Four match-3 elemental gems sheet",
    width: 128,
    height: 128,
    background: "transparent",
    publicPath: "assets/gems/gems-set.png",
    prompt: `${STYLE_FOUNDATION}, transparent background where applicable. A cohesive set of four original 16-bit pixel-art match-3 elemental gems arranged in a 2x2 grid: red flame, blue ice, green leaf and yellow light, each with a clearly different silhouette rather than color alone, high readability at small size, limited palette, crisp hard pixel edges, no letters, no text, no watermark.`,
  },
  {
    id: "env-worldmap",
    purpose: "World-map environment sample",
    width: 256,
    height: 144,
    background: "opaque",
    publicPath: "assets/env/env-worldmap.png",
    prompt: `${STYLE_FOUNDATION}. Original 16-bit fantasy JRPG pixel-art world map environment sample, top-down or slight isometric hills paths forest and a small settlement marker, limited green earth and sky palette, modular tileset feel, no text, no watermark, readable at small scale.`,
  },
  {
    id: "env-village",
    purpose: "Village hub environment with three facility zones",
    width: 512,
    height: 288,
    background: "opaque",
    publicPath: "assets/env/env-village.png",
    prompt: `${STYLE_FOUNDATION}. Original 16-bit fantasy JRPG pixel-art village hub side-view background, warm cobblestone plaza, three readable building zones left-to-right: a stone mine entrance with timber supports and ore carts, an open training yard with wooden dummies and sparring posts, a workshop shed with forge glow and hanging tools, soft afternoon sky, limited warm earth and soft sky palette, empty of player characters, no text, no watermark, no UI.`,
  },
  {
    id: "battle-boss-bg",
    purpose: "Empty goblin fortress boss arena backdrop (no characters)",
    width: 512,
    height: 288,
    background: "opaque",
    publicPath: "assets/env/battle-boss-bg.png",
    prompt: `Original 16-bit fantasy JRPG pixel art for a browser game, late-SNES-era visual language, side-view empty boss arena inside a dark goblin fortress, torchlit stone hall, cracked floor, ominous red-amber lighting, open staging areas on left and right for sprites, limited dark earthy palette with ember accents, crisp hard pixel edges, no anti-aliasing, no text, no watermark, no UI, absolutely no characters, no people, no heroes, no enemies, no creatures, no monsters, empty scenic battlefield environment only`,
  },
  {
    id: "icon-gold",
    purpose: "Gold coin currency icon",
    width: 48,
    height: 48,
    background: "transparent",
    publicPath: "assets/ui/icon-gold.png",
    prompt: `${STYLE_FOUNDATION}, transparent background. Single original 16-bit pixel-art gold coin icon, round coin with simple embossed crest, warm gold yellow palette, crisp hard edges, high readability at 32px, no text, no letters, no watermark.`,
  },
  {
    id: "icon-materials",
    purpose: "Materials crate currency icon",
    width: 48,
    height: 48,
    background: "transparent",
    publicPath: "assets/ui/icon-materials.png",
    prompt: `${STYLE_FOUNDATION}, transparent background. Single original 16-bit pixel-art wooden supply crate icon with metal bands and a small ore chunk on top, earthy brown and grey palette, crisp hard edges, high readability at 32px, no text, no watermark.`,
  },
  {
    id: "facility-mine",
    purpose: "Village Mine facility icon",
    width: 96,
    height: 96,
    background: "transparent",
    publicPath: "assets/ui/facility-mine.png",
    prompt: `${STYLE_FOUNDATION}, transparent background. Original 16-bit pixel-art village Mine building icon, stone tunnel entrance with timber supports and a small ore cart, readable silhouette, limited grey brown palette, no characters, no text, no watermark.`,
  },
  {
    id: "facility-training",
    purpose: "Village Training Ground facility icon",
    width: 96,
    height: 96,
    background: "transparent",
    publicPath: "assets/ui/facility-training.png",
    prompt: `${STYLE_FOUNDATION}, transparent background. Original 16-bit pixel-art Training Ground facility icon, wooden sparring posts and a practice dummy on packed earth, readable silhouette, warm wood palette, no characters, no text, no watermark.`,
  },
  {
    id: "facility-workshop",
    purpose: "Village Workshop facility icon",
    width: 96,
    height: 96,
    background: "transparent",
    publicPath: "assets/ui/facility-workshop.png",
    prompt: `${STYLE_FOUNDATION}, transparent background. Original 16-bit pixel-art Workshop forge shed icon, anvil bellows and warm forge glow, readable silhouette, brown and ember palette, no characters, no text, no watermark.`,
  },
  {
    id: "icon-warriors",
    purpose: "Party warriors training icon",
    width: 64,
    height: 64,
    background: "transparent",
    publicPath: "assets/ui/icon-warriors.png",
    prompt: `${STYLE_FOUNDATION}, transparent background. Original 16-bit pixel-art icon of two small fantasy warrior silhouettes standing ready with simple weapons, compact party emblem feel, limited red and steel palette, readable at small size, no faces detail required, no text, no watermark.`,
  },
];

export const GEM_IDS = ["gem-flame", "gem-ice", "gem-leaf", "gem-light"];
