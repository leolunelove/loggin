# Loggin’

A small third-person lumberjack game in an autumn forest painted in oils. Chop trees, haul logs home, stack the camp woodpile, and work your way through five axes.

[Play Loggin’](https://leolunelove.github.io/loggin/) · [Build and deployment](https://github.com/leolunelove/loggin/actions)

## The loop

1. Hold left-click beside a tree. Overhead, diagonal and compact chops bite progressively into the trunk.
2. Felled wood goes into your canvas bag. Follow the compass back to the starting shack.
3. At the outdoor rack, press E or left-click once. Your character stows the axe, lifts bundles from the bag and stacks them at camp. Wood transfers when each bundle lands. Moving cancels and keeps unplaced logs in the bag.
4. Press U to spend stored wood on axes, swing speed or yield. New axes have distinct heads, handles and fittings.
5. Return to the woods. Birch, beech, maple and oak offer different rewards; trees regrow after 90 seconds.

The bag holds 24 timber until the woodshed is built. Delivering 40 ordinary timber completes the woodshed in visible stages and expands capacity to 64. Yield upgrades then add 16 capacity each, so larger harvests still fit. A tree can only be chopped when its full yield fits; existing oversized saves retain all carried wood.

Oak and maple are hardwood: build the woodshed and equip the felling axe to harvest them. Hardwood shares bag capacity and is tracked when unloaded; advanced axes require 8 hardwood alongside their timber price. Woodshed progress counts cumulative ordinary timber deliveries without consuming your spendable stockpile.

No hunger, stamina, accounts, server or external runtime services. Progress and preferences stay in this browser. Existing Woodsmoke saves migrate into an isolated camp save so older open builds cannot overwrite new progression; moving to another hostname starts a separate browser save.

Swings follow through while you move. A stroke only damages its tree when still in reach at contact; retreating produces a miss. Lock onto an aimed tree with right-click or Q, then press again to release. Felling, range and menus also release the lock.

**Settings → What’s new · Changelog** contains illustrated field notes with screenshots of the game.

## Walk into your shack

Approach the front doorway and the door swings open. Walk through with WASD; the camera rises and the roof and near walls cut away to reveal the room. Mouse look still controls the view and movement heading. The doorway and walls have real collision; there is no scene teleport.

Supply shelves reflect stored logs, hardwood and planks. Purchased axes stay on the wall, building mementos mark completed projects, and a camp board displays your totals. Press E or left-click inside to open the camp ledger, then Open workbench for upgrades and building work. Logs are still unloaded at the outdoor rack.

The finished porch adds a rug. Completing the cabin extension removes the rear partition and opens a furnished room with a bed and reading shelf. Walk back through the front door to return to the forest.

## Build a bigger camp

After the woodshed, use **U → Grow your camp** while near the shack:

- Contribute up to 8 hardwood at a time to the sawmill. Its foundations, posts, beams, cutting bed and roof appear as the 40-hardwood project advances. Contributions consume stored hardwood and its corresponding logs.
- At the completed sawmill, 8 ordinary stored logs become 2 planks in 3 seconds. Hardwood is reserved for construction and tools. An active cutting job survives a reload and completes only once.
- Spend 12 planks on the visible camp porch to cut milling time to 2 seconds.
- Then spend 24 planks on a cabin extension, adding a visible rear room and 32 carrying capacity.

## Your lumberjack and world

Choose shirt, hat, bag, skin tone and hair in the live 3D entry preview. Turn the character to inspect the outfit before entering. Choices are saved with the camp.

New camps roll a random seed for terrain, tree layout and a winding, shallow river. A clear camp footprint and nearby starter trees keep the first deliveries approachable. The entry sequence reveals ground, water, tree batches and camp from an overview. Reloading a save rebuilds the same world; it does not reroll progress. Legacy seed-zero saves preserve their tree ordering.

**Settings → Reset camp & grow a new world** opens an explicit reset confirmation. Reset clears progression and felled trees, rolls a new world and keeps your outfit. **Undo last camp reset** on the entry screen restores the previous camp. Browser storage must be available for reset and recovery.

## Controls

| Input | Action |
| --- | --- |
| Mouse | Look freely |
| WASD / arrows | Move and strafe |
| Shift + forward | Run |
| Hold left mouse / E / Space | Chop nearby trees |
| E / left mouse at rack | Start unloading |
| Right-click / Q | Toggle tree lock; strafe while keeping the tree in view |
| Mouse wheel | Zoom |
| U | Upgrades |
| Esc | Release cursor / close menu |

Enter/Resume captures the mouse when supported. Embedded browsers use button-free mouse movement if pointer lock is denied. The recapture click never chops. Touch controls and gamepad inputs are implemented; physical-device feel needs separate verification.

## Run locally

Use Node 24 (minimum 22.12) and pnpm 11.25.0.

```sh
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

Open the printed localhost URL. For the release build:

```sh
pnpm test
pnpm build
node tools/check-build.mjs
pnpm serve
```

The self-contained `dist/` folder can be hosted as static files. Serve it over HTTP; opening `index.html` directly as a file will not load the modules correctly.

## GitHub Pages

Push this source to a repository with `main` as its default branch. In **Settings → Pages**, select **GitHub Actions** as the source. The included workflow checks the game, builds `dist/` and publishes it on pushes to `main`; pull requests run checks without deploying. No deployment secret is needed. Asset URLs are relative so project URLs such as `/loggin/` work. The workflow follows [GitHub’s Pages deployment guidance](https://docs.github.com/en/get-started/start-your-journey/deploying-your-website-automatically).

To make portable archives after building, run `python3 tools/package-release.py`. `Loggin-source.zip` contains the source, tests, assets, licences and Pages workflow, without the existing hosting identity. `Loggin-web.zip` contains the playable static build. These archives do not include dependencies or Git history.

## Development review

`tools/motion-review.html` on the dev server offers pose steps, slow playback, swing forms and grip/contact measurements. `tools/feature-review.html` compares cut depth, the five axe models and unloading poses. Review frames disable saving and damage; they are not included in `dist/`.

Automated coverage includes progression, storage, recovery, one hit per swing, input/cancellation, terrain-aware tree falls, sound attacks, real rig grip/limb constraints, frame-rate-independent turning, cut geometry/regrowth, axe visibility and interrupted unload transfers. Browser checks cover chopping, hauling, unloading, purchases, save restoration and side-view animation inspection. GitHub Actions runs these checks before publishing updates to GitHub Pages.

## Credits and licensing

Built from Blendi / Patch’s [Oil Paint](https://patch.gg/blendi/oil-paint) renderer, forest and CC0 wanderer. Loggin’ adds the lumberjack loop, tools, coordinated procedural animations, carrying pack, shack, economy, UI, browser saves, sound and tree felling/regrowth.

Original code: MIT. Character and clips: CC0; see `LICENCE-NOTES.md`, `OIL-PAINT-REFERENCE.md` and `public/LICENSES/`. Three.js: MIT. Rapier: Apache-2.0. Recorded sound licences are retained with `public/audio/`. Original notices remain in `LICENSE` and the production build. Do not remove these when publishing a fork.
