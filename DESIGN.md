# Loggin’ design and interaction rules

Loggin’ is a minimal lumberjack game: chop wood and use it to improve tools. The forest is the main screen. Preserve the original Oil Paint visual rendering from [Blendi’s reference](https://patch.gg/blendi/oil-paint): brush strokes fixed to the world, autumn beech/birch/oak/maple, warm mist, long shadows, and the existing third-person composition. The wanderer wears an open blue canvas wood pack with leather straps in place of the original cape.

## Preserve

- Keep the original forest palettes, brush renderer, foliage density, light, terrain, character and clear-space camera framing. Quality settings may reduce rendering cost.
- Keep the wood pack attached to the torso during movement and chopping. Its visible logs settle in as wood is collected and leave when unloaded at the starting shack. The compact stack represents the balance, capped at nine visible logs; the HUD shows exact Bag and Stored counts. This adds no carrying limit.
- Keep the loop bounded to chopping, returning wood to the shack, and upgrades. No quests, stamina, hunger, inventory grids, currencies, timers, or required accounts inside gameplay.
- Keep the existing browser save key and existing balances. Extend saved preferences with backwards-compatible defaults.
- Keep the full viewport playable. Menus temporarily overlay it.

## Controls

- Desktop: continuous mouse look, WASD / arrows move and strafe, Shift + forward runs, left mouse holds repeated chops, E / Space are alternatives, wheel zooms, U opens upgrades, Esc releases the cursor.
- Request pointer lock from an explicit Enter / Resume gesture. The recapture gesture never damages a tree. Do not capture on a menu close.
- Embedded browsers may deny pointer lock. Use button-free mouse movement there; release it on Esc, leaving the canvas, blur, or a hidden tab. Never reintroduce desktop dragging. This fallback does not provide unlimited rotation beyond the window’s edges.
- Preserve normal Tab navigation and native range-key controls in menus. Clear held inputs on loss of focus, capture, and menu transitions.
- Touch-only dragging is separate from desktop controls. Physical-phone and gamepad feel need device verification.
- Apply a short 32/s exponential mouse-look filter before selecting a tree and computing movement. Use continuous eased body aiming with a small idle head allowance; mouse aiming does not wait for canned 90-degree turns. Mouse sensitivity is adjustable between 0.5 and 2 times the default.

## Starting shack

- Keep the shack beside the original starting tree, with weathered plank walls, a moss-green shingle roof, an outdoor wood rack, and the same world-pinned brush rendering. Preserve tree ordering and existing saved IDs.
- Chopping adds to `carried`; the pack shows carried wood. At the outdoor rack, E / left-click / the touch action starts a short sequence: stow the axe, reach into the pack, lift a bundle, and stack it. Commit each batch into stored `wood` when the bundle lands. Movement, menus and lost capture cancel; unplaced wood stays carried. Stored wood buys upgrades; carried wood must be brought home first. No bag capacity limit.
- Keep legacy wood balances as stored wood and default new carried balances to zero. Save both with the existing browser save key and backup recovery.
- A small compass bearing and distance keep the shack findable. Buildings and the rack have solid collision; unloading requires reaching the rack.

## Targeting and chopping

- Pick a visible tree in the camera’s forward cone, favouring reachable trees. Do not use the character’s exact standing direction to reject a tree beside their shoulder.
- Use the same 1.3 m edge-of-trunk reach for prompts and starting a swing, with only a small impact tolerance.
- Movement interrupts a swing immediately. Looking away, leaving reach, menus, and focus loss cancel uncommitted damage. A normal click may complete one swing after mouse-up; holding repeats.
- Carve a growing V-shaped wedge into the actual trunk geometry; expose pale wood and remove overlapping bark dabs. Restore all geometry and paint when the tree regrows.
- Five axe tiers have distinct silhouettes and materials, while their leading blade contact stays aligned with the swing.
- Keep one damage event per swing. Damage, chips, bark cut, health feedback, and hit sound share the contact time. Use preloaded field-recorded axe takes with immediate attacks; avoid repeating the same take consecutively.
- Motion: select among overhead, diagonal shoulder, and compact chops without adjacent repeats. Both hands grip the handle through a deliberate windup, accelerating strike, brief tool contact, pull-out, and measured recovery. Cadence, damage and contact timing remain consistent across forms. Use planted feet, a small knee bend and hip weight shift; the body absorbs contact while the tool holds. Finishing hits have a stronger drive and extraction. Solve the arms without changing bone lengths; aim the blade at the shared impact point. Turn into a chop gradually before starting. Blend cancelled poses out over 140 ms while movement resumes immediately. A committed finishing strike completes its recovery when the tree falls; movement still interrupts. Fit free windups to both arms and keep the handle clear of the hat. Contact pauses the axe, never the camera or movement. No screen shake or camera zoom as a substitute for weight.
- A tree split, rushing crown, and ground impact are separate sounds. Derive the landing angle from the terrain and trigger the ground sound once on the same frame as contact; do not use a separate wall-clock timer. Falling trees leave a stump and painted log sections. Regeneration removes remains and restores the original tree and collider.

## Interface

- Persistent HUD: small wordmark, wood balance, upgrades, settings, and secondary keyboard hints. Show the chop prompt only when useful. Use one small contextual tree label; do not add a large reticle.
- Use direct language: Upgrades, Swing speed, Wood yield, Settings. Explain axe benefits in chops saved on a real tree. Disabled purchases state the missing wood.
- Avoid atmospheric filler under every action, repeated instructions, routine toasts, extra cards, badges, counters, or decorative progress systems.
- Existing palette: ink #f7eedb, muted #d8d2bc, dark forest surface #242b23, parchment controls #ecdfbc, warm feedback #f5e1a8. Surfaces must remain legible over bright foliage.
- Georgia is the display face; neutral sans-serif is for controls. Main labels normally 14px or larger; secondary metadata 12–13px. Keep close and purchase controls at least 44px high.
- Keep the cream control colour and serif title because they fit the supplied forest. Do not apply generic prompt bans that discard reference-specific choices.

## Motion and states

- Button state changes: 120ms; menu entrance: 160ms ease-out, at most 6px translation. No bounce, hover scale, decorative stagger, or routine screen animation.
- Health reacts promptly to impact. A wood reward rises once, then leaves. Menus are interruptible through close, U, or Esc as appropriate.
- Respect reduced-motion preferences: static loading mark, instant menu transitions, stationary reward label. The core chopping and falling animations communicate gameplay.
- Support loading failure with a reload action. Save failure must be stated honestly; use the previous valid backup when the primary save is damaged. Never silently claim persistence after a write error.

## Verification before release

Run `pnpm test` and `pnpm build`. Play the first two trees and first upgrade in the browser. Check close-range selection, movement during windup, Esc / Resume, menu focus, sensitivity, disabled prices, and reload persistence. Verify the same forest composition after changes. Record physical-device, listening and full pointer-lock checks separately from embedded-preview and automated checks.

## Loggin’ identity

Use a bold cream serif wordmark, worn brass controls, dark timber panels, and restrained camp language. Keep the forest full-screen. Explain the chop, haul, stack, upgrade loop on the start screen. Preserve save keys and input event names during renaming.
