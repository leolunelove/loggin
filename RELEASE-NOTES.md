# Tree locking, moving swings and illustrated field notes

Right-click or Q toggles lock onto an aimed, visible nearby tree. Locked trees retain selection while strafing and the camera tracks them smoothly. The lock releases on felling, excess distance or menu/cursor release. Right-click presses are edge-triggered so holding the button never repeatedly toggles the lock.

An axe stroke now follows through when movement starts, and its contact pose tracks the player without extending the arms toward a distant trunk. Damage is checked at the impact frame; stepping out of reach produces a miss. The walking gait stays active during the stroke.

Settings now contains What’s new, an in-game changelog with three actual game screenshots. Images are bundled locally and loaded when the notes are opened.

Browser verification covered right-click lock/release, strafing, a hit surviving movement during a stroke, and opening/closing the illustrated menu with all images loaded.

---

# Sawmill, planks and a fresh start

The camp now grows from woodshed to hardwood sawmill, plank-funded porch and cabin extension. Sawmill construction consumes 40 hardwood in visible stages. Eight ordinary logs produce two planks; the porch shortens cutting time and the larger cabin increases carrying capacity.

Entry includes a live rotating character preview with five appearance choices. New camps have seeded terrain, tree placement and a winding river, revealed progressively before play. Reloads retain the world. Reset has a confirmation and an undo copy; returning pages cannot overwrite a newly reset save. Legacy saves migrate into an isolated camp slot; other active tabs pause with a reload prompt when that camp changes.

Validation: 49 automated checks pass, including sawmill costs, interrupted milling, plank project ordering, save migration, reset/undo, appearance, real construction geometry, and reproducible seeded forests and terrain. Browser checks exercised character choices, world generation, river rendering, sawmill contributions and plank production, both larger buildings, reset to a different seed, and undo restoration. Physical phone/gamepad performance remains unverified.

---

# Loggin’ — playable loop release

The start screen, camp HUD and workbench now use the Loggin’ identity. The playable loop is chop, carry, return to camp, unload, and upgrade.

- Tree damage carves a progressively deeper V-shaped cut into the trunk and exposes fresh wood. Bark paint is cleared around the bite; regrowth restores the original geometry.
- Five distinct axe models progress from rough hatchet to double-bit forester’s axe. Tool previews appear at the workbench, and upgrades equip immediately.
- Unloading stows the axe, reaches into the pack, lifts a bundle and stacks it at the rack. Each batch transfers only when it lands. Cancelling preserves unplaced wood, and the axe blends back into the hand.
- The original three realistic swing forms, sound, turning and existing save compatibility remain.
- Startup graphics warmup has a bounded fence check to avoid an embedded-driver loading hang.

Validation: all 35 automated checks pass. Browser review covers cut stages, tool silhouettes, two-handed unloading, and the complete loop with existing progress. The exported static build also passed a fresh-save playtest at `/loggin/`: two birches produced 16 carried wood, an interrupted unload preserved all 16, completing the unload stored 16, the first axe cost 12, and a reload retained the felling axe with 4 stored wood. Models and sounds loaded at the repository subpath without console errors.

The source and web ZIP archives are portable and integrity-checked. The source export's feature tests also passed after extraction using the already installed dependency set. GitHub Pages is configured through the included Actions workflow; deployment status is available in the repository’s Actions tab. Physical-phone/gamepad feel and unrestricted desktop pointer lock still need device verification.
