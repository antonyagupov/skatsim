# Skatsim — улучшения по статьям Habr

Документ переводит идеи из трёх статей в конкретный бэклог для Skatsim (JRPG + match-3 combat). Источники:

| # | Статья | Фокус |
|---|---|---|
| A | [Движок для матч-3 батлера](https://habr.com/ru/articles/748364/) | Симуляция поля, каскады, урон по врагам, производительность |
| B | [«Собери 3 сердца…»](https://habr.com/ru/articles/254649/) | Геймплей-система, туториал, аналитика, боты, контент |
| C | [Настройка общего баланса три в ряд](https://habr.com/ru/articles/266121/) | Кривая сложности, режимы, метрики, пейволы |

Статус базы: **v0.2.0**, playable chapter loop — см. `docs/GDD.md`.

---

## 1. Что уже совпадает с лучшими практиками

Не копировать слепо — усиливать то, что уже заложено.

| Практика из статей | Уже в Skatsim |
|---|---|
| Match = бой, не отдельный пазл (A, B) | Design pillar «Matches are combat» |
| Цвета → роли героев (A, B) | Flame/Ice/Leaf/Light → Warrior/Mage/Ranger/Priest |
| Каскады и досып (A) | Gravity + refill + cascade multiplier |
| Элементальный RPS (A) | R>G>Y>B>R, ×1.5 / ×0.75 |
| Countdown-атаки врагов (A) | Enemy countdowns + Extra Move без тика |
| Системный баланс, не «на глаз» (B, C) | Формулы в `combat/formulas.ts`, тесты |
| Интерактивный туториал (B) | Contextual, skippable prompts |
| Чистая логика отдельно от UI (A) | `src/systems/` Phaser-free + Vitest |

---

## 2. Приоритетный бэклог

Приоритет: **P0** — даёт ощутимый геймплей сейчас; **P1** — усиливает главу/ретеншн; **P2** — масштаб / live-ops.

### P0 — ядро боя и читаемость

#### 2.1 Таблица урона от матча → враги (статья A)

В референсе Empires & Puzzles фишки «летят» вверх и бьют врагов на линии. В Skatsim урон уже идёт через героев по цвету — это ок, но можно усилить **читаемость связи матч → удар**:

- [x] VFX-траектория: cleared gems → projectile к цели героя (не абстрактный flash).
- [x] Явный «hit row / target flash» на враге в момент применения урона цвета.
- [ ] Если два врага в зоне одного героя-ST — показать split / выбор цели (сейчас Warrior = selected; Ranger = lowest %).
- [x] Документировать правило: **один матч → одна волна атак героев**, без скрытого double-dip.

**Файлы:** `BattleScene.ts`, `BattleController.ts`, `targeting.ts`.

#### 2.2 Детерминизм симуляции хода (статья A)

Для отладки, реплеев и будущих тестов баланса:

- [x] Seeded RNG на весь бой (`createBoard`, refill, shuffle, enemy AI).
- [x] Лог «резолва хода» как чистый data-event stream (matches → gravity → fills → hero actions → enemy ticks).
- [x] Debug: `replaySeed` / dump board after N swaps.
- [ ] Бенчмарк resolve cascade (не Stopwatch в UI — Vitest/`performance.now` в тестах).

**Зачем:** статья A требовала ~5 ms симуляции на сервер; у нас клиент, но детерминизм ускоряет баланс и багфиксы.

#### 2.3 Локальные проверки после гравитации (статья A)

Сейчас после fill часто проверяется всё поле. Оптимизация и дизайн:

- [ ] После gravity/fill проверять только **затронутые столбцы ± 2 клетки** (как в статье), если профилирование покажет стоимость.
- [ ] Гарантия: нет готового матча на старте; ≥1 легальный ход; shuffle без мгновенных матчей (уже есть — покрыть edge cases тестами).

#### 2.4 Умный, но не «жульничающий» AI врагов (статья B §7)

Монстры в статье B играли в match-3 через Minimax; слишком умный бот воспринимался как читер.

Для Skatsim враги бьют по countdown, не ходят по полю — но паттерны босса уже есть. Улучшения:

- [ ] Таблица врагов: приоритет целей (lowest HP / healer / random) как **явный тег**, не чёрный ящик.
- [ ] Boss patterns: 2–3 читаемых телеграфа (Cleaver / War Cry уже есть) + один «fair» special на фазе 2.
- [ ] Не добавлять AI, который «знает» будущий refill RNG.
- [ ] Сложность врага поднимать **статами / countdown / armor**, а не предсказанием поля.

#### 2.5 Туториал без текста-стены (статьи B §5, C §2)

- [x] Первые 3 ноды = «вся суть игры» (матч → урон → countdown → ability), без отложенной уникальности.
- [x] Обучение через forced highlight + анимацию, минимум абзацев.
- [ ] Analytics-хуки: `tutorial_step_start` / `tutorial_step_complete` / `tutorial_skip` (даже если сначала в console / local log).
- [x] Не учить все Village-апгрейды до Dark Cave — только после 1–2 побед.

---

### P1 — кривая главы и баланс контента

#### 2.6 Кривая сложности главы (статья C)

Сложность ≠ линейный рост HP. Игроку нужны «подходы» и передышки.

Предлагаемая кривая Chapter 1 (win-rate / attempts как целевые ориентиры):

| Node | Роль на кривой | Целевая сложность | Фокус обучения |
|---|---|---|---|
| Ruins Path | Hook + суть игры | ~85–90% win | swap, target, colors |
| Forest Trail | Лёгкое нарастание | ~75–80% | cascade, elements |
| Old Quarry | Mid spike | ~55–65% | armor, Extra Move |
| Dark Cave | Передышка / награда | ~70–75% | abilities + potion |
| Goblin Fortress | Пик эпизода | ~40–55% | phase 2, resource spend |

- [x] Завести таблицу баланса (Google Sheet / `docs/balance-ch1.csv`): node, enemy HP/ATK, countdown, expected attempts, notes.
- [ ] После пика (босс) — Chapter 2 начинать с **спада**, не с ещё более жёсткого узла.
- [ ] Не ставить два «FUUU»-уровня подряд (почти победа → поражение каждый раз).

#### 2.7 Режимы / цели боя — вводить постепенно (статья C)

Сейчас цель везде одна: убить всех. Разнообразие без смешения двух целей в одном бою:

| После ноды | Новая механика (одна за раз) |
|---|---|
| Ruins | Базовый clear |
| Forest | Element advantage показан явно |
| Quarry | Armor / heavy countdown |
| Cave | Survive N turns **или** elite pack (выбрать одно) |
| Boss | Phase change + summon |

- [ ] Не смешивать «набрать очки» и «убить босса» в одном бою.
- [ ] Не повторять один и тот же encounter-паттерн два узла подряд без вариации состава.

#### 2.8 Системный баланс статов (статья B §1)

- [ ] Excel/Sheet: hero level → HP/ATK/ability; enemy level → HP/ATK/countdown; gold/materials payout.
- [ ] Единый коэффициент прогрессии (сейчас ~+12% за уровень героя) — вынести в именованные константы + таблицу.
- [ ] Симулятор: N seeded боёв на ноду → win rate, median turns, potion usage (скрипт в `scripts/` или Vitest suite).

#### 2.9 Экономика поражений и «почти победа» (статья C)

Match-3 монетизирует поражения; у Skatsim пока нет IAP, но та же психология влияет на ощущение честности:

- [ ] Метрика: доля поражений при враге <15% HP / герои почти полные — снижать «FUUU» через small heal drop или Extra Move на mid-HP boss.
- [ ] Награда за старание: даже при поражении — 10–20% gold/materials (опционально, для browser-игры без жизней).
- [ ] Village spend должен ощущаться **перед** Fortress, не после трёх фейлов подряд без ресурсов.

#### 2.10 Achievements vs квесты (статья B §2)

- [ ] Отделить: **квест** = награда в мире (золото/материал); **achievement** = долгосрочный статус (без обязательного лута).
- [ ] Примеры ачивок: «Extra Move streak 2», «победа без зелья», «убить босса с prismatic».
- [ ] UI празднования ачивки — позитивный, короткий, без блокировки боя.

---

### P2 — продукт, live-ops, масштаб

#### 2.11 Аналитика (статьи B §4, C)

Минимум событий (можно начать с `localStorage` ring-buffer + export JSON):

| Event | Параметры |
|---|---|
| `battle_start` | nodeId, seed, party levels |
| `battle_end` | win/lose, turns, potionUsed, remaining enemy HP% |
| `move_resolve` | matchLens, cascades, extraMove |
| `ability_used` | heroId |
| `tutorial_*` | stepId |
| `village_upgrade` | facility, level |
| `session` | DAU-like: day key |

Позже: Flurry/GA-аналог или Netlify function ingest. Издатели смотрят MAU/DAU/retention 2/7/28 — заложить имена метрик заранее.

#### 2.12 CMS / data-driven контент (статья B §8)

- [ ] Вынести encounter definitions, enemy stats, rewards в JSON/TS data (частично уже `mapNodes.ts` / `enemies.ts`) — единый каталог.
- [ ] Версия контента в save: клиент подтягивает новые ноды без ломки прогресса.
- [ ] Checksum/hash для remote assets, если появится CDN-докачка.

#### 2.13 Обратная связь из игры (статья B §10)

- [ ] Кнопка «Report / Feedback» (mailto или form) на Menu/World.
- [ ] Короткий Help: controls + elemental cycle + Extra Move — чтобы жалобы не уходили только в отзывы.

#### 2.14 Аудио и полировка (статья B §13)

Уже есть procedural SFX. Следующий шаг:

- [ ] Отдельные one-shots на ability / boss phase / defeat (часть есть).
- [ ] ТЗ на внешнюю музыку: «battle heroic but not bombastic», «village calm loop», длительность лупов.

#### 2.15 Локализация (статья B §6)

- [ ] Вынести строки UI в словарь `en` / `ru`.
- [ ] Не хардкодить длину кнопок — закладывать +30% под немецкий/французский, если пойдёте шире.

---

## 3. Технические заимствования из движка матч-3 батлера (A)

Применимо к `src/systems/match3/board.ts` и combat layer.

| Идея из статьи | Действие для Skatsim | Приоритет |
|---|---|---|
| 1D board вместо nested arrays | Опционально после бенчмарка; сейчас 7×7 — не bottleneck | P2 |
| Bitmask «какие клетки в матче» | Удобно для VFX/debug overlay столбцов | P1 |
| Проверка хода: сосед → в клетку, а не клетка во все стороны | Ускорить `hasAnyMove` / legal swap enum | P1 |
| Фиксированные буферы / меньше аллокаций в resolve | Пулы массивов клеток в hot path, если GC заметен | P2 |
| Враги на рядах + bitmask занятости | Если появится «линия удара» / multi-row staging | P1–P2 |
| Цвет фишки × цвет врага (уже есть) | Показать множитель в UI урона («WEAK!» / «RESIST») | P0 |
| Пул баффов/дебаффов без GC | Когда появятся DoT/shields beyond Priest | P1 |
| Специальные фишки | Уже Prismatic; следующие: line/bomb — по одной за главу | P1 |

### Предлагаемый event model резолва (для UI и тестов)

```text
SwapAccepted
  → MatchFound[] (cells, color, length)
  → Clear
  → Gravity
  → Fill
  → (loop while matches)
  → HeroActions[] (from color totals × cascade mult × element)
  → EnemyCountdownTick | EnemyAttacks[]
  → Victory | Defeat | AwaitInput (+ ExtraMove flag)
```

Это близко к «фиксированным данным результата хода» из статьи A и упрощает анимационную очередь в `BattleScene`.

---

## 4. Баланс-таблица (шаблон)

Скопировать в Sheet / `docs/balance-ch1.csv`:

```csv
node_id,role,target_win_rate,target_attempts,enemy_ids,new_mechanic,notes
ruins_path,hook,0.88,1.2,slime+bat,core_loop,show uniqueness by node 3
forest_trail,ramp,0.78,1.4,forest_slime+shadow_bat,elements,
old_quarry,mid_spike,0.60,2.0,armored_goblin+bat,armor,
dark_cave,breather,0.72,1.5,elite_pack,abilities_potion,reward beat
goblin_fortress,episode_peak,0.48,3.0,chieftain(+bat),phase2,paywall-like skill check
```

Правила из статьи C:

1. Первые 3 уровня = вся суть продукта.
2. Обучающие ноды = шоу, не стена текста.
3. Самые жёсткие — **конец** локации (Fortress).
4. После пика — спад на старте следующей главы.
5. Один новый механикный «режим» за раз; не две равноправные цели в одном бою.

---

## 5. Метрики успеха улучшений

| Область | KPI | Как мерить |
|---|---|---|
| Онбординг | % дошедших до Forest / Quarry | tutorial + battle_end |
| Честность | доля close-loss (enemy HP <15%) | battle_end |
| Понятность режима | win rate на Ruins ≥ 85% | battle_end |
| Пик главы | Fortress win rate 40–55% без апгрейдов vs с Village | segment by building levels |
| Туториал | completion / skip / stuck step | tutorial_* |
| Бой feel | средний cascade depth, Extra Move rate | move_resolve |

«Если игра приносит деньги — хорошо; если знаете почему — отлично» (C). Для browser-MVP: **retention D1/D7 + chapter clear rate** вместо ARPU.

---

## 6. Рекомендуемый порядок внедрения (2–3 итерации)

### Итерация 1 — Feel & fairness ✅ (2026-07-17)
1. Damage VFX матч → герой → враг + WEAK/RESIST numbers  
2. Seeded battle RNG + resolve event log  
3. Подкрутка кривой Ch1 по таблице §4  
4. Туториал: суть за 3 ноды, меньше текста  

### Итерация 2 — Systems
1. Balance sheet + combat sim script  
2. Enemy telegraph / fair boss AI tags  
3. Defeat consolation rewards (опционально)  
4. Achievements (5–8 штук)  

### Итерация 3 — Product
1. Analytics export  
2. i18n strings  
3. In-game feedback  
4. Data-driven encounters / content version  

---

## 7. Что сознательно не брать из статей

| Идея | Почему не сейчас |
|---|---|
| Серверная симуляция матча за 5 ms (A) | Нет authoritative multiplayer |
| PvP + Minimax bot на поле игрока (B) | Out of scope GDD §14 |
| IAP / пейвол ходов (C) | Нет жизней и магазина; сначала честный skill curve |
| Mongo CMS + Amazon (B) | Overkill для статического Vite/gh-pages |
| Копировать Candy Crush онбординг (C) | Статья прямо против слепого копирования — показывать **свою** фишку (party на одном экране с полем) |

---

## 8. Связь с кодовой базой

| Улучшение | Точки входа |
|---|---|
| Board / moves / cascade | `src/systems/match3/board.ts` |
| Turn pipeline | `src/systems/BattleController.ts`, `combat/stateMachine.ts` |
| Damage / elements | `combat/formulas.ts`, `combat/elements.ts` |
| Enemies / boss | `combat/enemies.ts`, `combat/targeting.ts` |
| Chapter curve / rewards | `data/mapNodes.ts`, `economy/rewards.ts` |
| Tutorial | `systems/tutorial/TutorialManager.ts` |
| Presentation / VFX | `scenes/BattleScene.ts` |
| Design truth | `docs/GDD.md` (обновлять при принятии пунктов) |

---

## 9. Краткий вывод

Статьи сходятся в трёх принципах, полезных Skatsim:

1. **Бой и матч — одна система** с прозрачными правилами урона и читаемой симуляцией (A).  
2. **Геймплей и баланс — таблицы + метрики**, не интуиция; туториал интерактивный; AI честный (B).  
3. **Кривая главы дышит**: hook → обучение → mid spike → передышка → пик в конце локации (C).

Ближайший выигрыш: визуальная связь матч→урон, seeded реплеи, таблица сложности Chapter 1 и сжатый онбординг за первые три ноды.
