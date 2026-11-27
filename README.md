# Loggin’

A small third-person lumberjack game in an autumn forest painted in oils. Chop trees, haul logs home, stack the camp woodpile, and work your way through five axes.

[Play Loggin’](https://leolunelove.github.io/loggin/) · [Build and deployment](https://github.com/leolunelove/loggin/actions)

## The loop

1. Hold left-click beside a tree. Overhead, diagonal and compact chops bite progressively into the trunk.
2. Felled wood goes into your canvas bag. On your first trip, follow the compass to the shack rack and tap E or left-click to start stacking. Later, the bearing picks the nearest restored home, open rack or parked cart with room for the whole bag. Mark a discovered home under **U → Woodland** to keep that bearing across saves.
3. At the outdoor rack, press E or left-click once. Your character stows the axe, lifts bundles from the bag and stacks them at camp. Wood transfers when each bundle lands. Moving cancels and keeps unplaced logs in the bag.
4. Press U to spend stored wood on axes, swing speed or yield. New axes have distinct heads, handles and fittings.
5. Return to the woods. Birch, beech, maple and oak offer different rewards; trees regrow after 90 seconds.

The bag holds 24 timber until the woodshed is built. Delivering 40 ordinary timber completes the woodshed in visible stages and expands capacity to 64. Yield upgrades then add 16 capacity each, so larger harvests still fit. A tree can only be chopped when its full yield fits; existing oversized saves retain all carried wood.

Oak and maple are hardwood: build the woodshed and equip the felling axe to harvest them. Hardwood shares bag capacity and is tracked when unloaded; advanced axes require 8 hardwood alongside their timber price. Woodshed progress counts cumulative ordinary timber deliveries without consuming your spendable stockpile.

No hunger, stamina, accounts, server or external runtime services. Progress and preferences stay in this browser. Existing Woodsmoke saves migrate into an isolated camp save so older open builds cannot overwrite new progression; moving to another hostname starts a separate browser save.

Closing the workbench with its close button or U returns control to the forest. Escape releases the mouse. Tap for one stroke or hold for a run of swings. Swings follow through while you move. A stroke only damages its tree when still in reach at contact; retreating produces a miss. Lock onto an aimed tree with right-click or Q, then press again to release. Felling, range and menus also release the lock.

**Settings → What’s new · Changelog** contains illustrated field notes with screenshots of the game.

## Walk into your shack

Approach the front doorway and the door swings open. Walk through with WASD; the camera rises and the roof and near walls cut away to reveal the room. Mouse look still controls the view and movement heading. The doorway and walls have real collision; there is no scene teleport.

Supply shelves reflect stored logs, hardwood and planks. Purchased axes stay on the wall, building mementos mark completed projects, and a camp board displays your totals. Press E or left-click inside to open the camp ledger, then Open workbench for upgrades and building work. Logs are still unloaded at the outdoor rack.

The finished porch adds a rug. Completing the cabin extension removes the rear partition and opens a furnished room with a bed and reading shelf. Walk back through the front door to return to the forest.

## Build a bigger camp

After the woodshed, open **U → Camp** near the shack.

- Contribute up to 8 hardwood at a time to the sawmill. Its foundations, posts, beams, cutting bed and roof appear as the 40-hardwood project advances. Contributions consume stored hardwood and its corresponding logs.
- At the completed sawmill, 8 ordinary stored logs become 2 planks in 3 seconds. Hardwood is reserved for construction and tools. An active cutting job survives a reload and completes only once.
- Spend 12 planks on the visible camp porch to cut milling time to 2 seconds.
- Then spend 24 planks on a cabin extension, adding a visible rear room and 32 carrying capacity.

## Life along the trails

A restored home's ledger has **Home**, **Trail & cart** and **Projects** pages. Stored wood is shared instantly. You can spend it at another home while the hauler is still on the road.

- **Haul timber.** Finish a 40-log trail, build a handcart for 8 planks, then hire a hauler for 16 ordinary logs. Press R beside the cart to stow a bag, take the handles or send a hired hand on rounds. The cart holds 192 logs. Its wheels follow turns independently and its wooden axle creaks as it travels. It rolls faster on connected trails and slowly across rough woodland.
- **Orchard Rest.** Take apples from the basket or the home ledger. A lunch lasts three camp hours and gives a 16% faster sprint. Find the blazed post to learn how to build three working trail lanterns.
- **Riverwatch.** Build the footbridge in four spans and cross to a stacking rack beside the eastern grove. Loads left there go straight into shared stock and appear in the hauler’s collection queue. The old ferryman left a pennant for the landing.
- **Pine Hollow.** Dress the axe edge for 8 hardwood and 4 planks, reinforce the cart to hold 288 logs, and lay timber steps to the charcoal kiln. Its old rafters teach you how to build a rain shelter and delivery rack along the trail.
- **Tend the woods.** Cut windthrown trunks along their chalk rings, hold Shift for a stronger stroke on tough wood, and look for figured oak and curly maple. Near a home, press R to blaze a mature tree for protection. Felled clearings flower, grow saplings and fill in with young trees as they recover.

Detailed tree crowns fade into painted silhouettes between 68 and 106 metres. Rain and morning mist draw in the horizon while roofs and chimney smoke remain visible as bearings.

## Your lumberjack and world

Choose a work shirt, quilted vest or split mill apron and pair it with a field brim, watch cap or rail cap. Five sets of colour swatches cover shirt, hat, bag, skin and hair. Turn the preview to see the fit from behind or choose **Close-up** to inspect the cap, face and stitching. It uses the same painted character, equipment, idle animation and bag load as the forest. Revisit **Settings → Visit the outfitter** to change clothes where you stand.

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
| R | Manage the nearby handcart, or reserve/release an eligible tree near a home |
| Shift + chop | Heavy stroke on hardwood or a fallen trunk |
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

### Day and night
A full day takes 18 active minutes. The clock pauses in menus and hidden tabs and is saved locally, without offline catch-up. Camp lanterns turn on gradually at dusk. Walk into the shack, press E, then choose **Sleep until morning** after 18:00 (or before 06:30) to wake at 06:30. Sleeping keeps your bag, supplies and upgrades. The starter shack includes a bedroll; the extension adds a bedroom.

### A campfire to build
The stone hearth outside the shack takes **12 ordinary logs from stored camp supplies**, contributed up to four at a time. Press E or left-click at the hearth, or use Campfire in the Upgrades menu near camp. No woodshed prerequisite. Part-built logs and the lit fire persist in saves; completed fires burn without upkeep. Animated flames, rising embers, drifting smoke and warm flickering light run locally. The stereo crackle is generated once per audio context from a long noise bed and irregular wood-fracture transients, fades with distance, muffles indoors and obeys the Sound toggle.

### Sit by the fire
Finishing the campfire also gives you a timber bench. Existing completed fires gain it automatically. Approach the bench and press **E / left-click** to sit. The character settles onto the seat, rests their hands, and stows the axe and bag while the camera eases into a fireside view. Mouse look adjusts that view gently. Press **E**, click **Stand up**, or use **WASD** to stand, then resume walking. Escape releases the cursor so you can leave the view running; day/night, smoke and crackling continue.

### Weather in the woods
Clear spells and rain drift through the day in seeded, three-hour game-time weather windows with gradual transitions. Roughly one morning in three brings mist between dawn and midmorning. Forecasts derive from the saved camp seed, day and hour, so menus and reloads cannot reroll them. Rain has wind-blown streaks, small ground splashes, a cooler overcast sky and thicker distance haze. Cabin, completed porch and sawmill roofs keep their covered areas dry. Stereo rain audio blends the outdoor wash into a closer wooden-roof patter under shelter, muffles the woods indoors and follows the Sound toggle. Fire and bench remain available in the rain.

### A woodland worth exploring
Three seeded locations surround the starting camp: Orchard Rest, Riverwatch and Pine Hollow. Their plots select relatively level ground on the near side of the river. Look for the camp signpost and explore west, north and north-west. Approach a shack and press E to open its field ledger. Restore it with 24 stored ordinary logs and 8 planks; then contribute 40 more ordinary logs to connect it to your starting camp. Each trail contribution reveals more path and clears its corridor. Completed trails give 25% faster movement. Restored shacks accept bag deliveries into your shared camp stock and offer sleep after 18:00. Discovery and construction persist in your existing save. This is a finite first region, not endless generation. New props include apple trees, garden beds, fences, mailboxes, barrels, a washing line, supply crates, a timber cart and roadside markers.

### Larger woodland homes
Discovered sites now use three separate building designs: a 6.4 × 5.2 m orchard cottage with veranda, a 4.8 × 8.2 m riverside cabin with a sloping roof and deep deck, and an 8 × 6.6 m twin-gabled logging lodge with a stone chimney and four beds. Each has matching collision walls, a human-scale doorway, furniture and an interior camera sized for its floor plan. Rain shelter follows the new footprints. Existing restoration and trail progress carries over.
