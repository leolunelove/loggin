# Loggin’ — playable loop release

The start screen, camp HUD and workbench now use the Loggin’ identity. The playable loop is chop, carry, return to camp, unload, and upgrade.

- Tree damage carves a progressively deeper V-shaped cut into the trunk and exposes fresh wood. Bark paint is cleared around the bite; regrowth restores the original geometry.
- Five distinct axe models progress from rough hatchet to double-bit forester’s axe. Tool previews appear at the workbench, and upgrades equip immediately.
- Unloading stows the axe, reaches into the pack, lifts a bundle and stacks it at the rack. Each batch transfers only when it lands. Cancelling preserves unplaced wood, and the axe blends back into the hand.
- The original three realistic swing forms, sound, turning and existing save compatibility remain.
- Startup graphics warmup has a bounded fence check to avoid an embedded-driver loading hang.

Validation: all 35 automated checks pass. Browser review covers cut stages, tool silhouettes, two-handed unloading, and the complete loop with existing progress. The exported static build also passed a fresh-save playtest at `/loggin/`: two birches produced 16 carried wood, an interrupted unload preserved all 16, completing the unload stored 16, the first axe cost 12, and a reload retained the felling axe with 4 stored wood. Models and sounds loaded at the repository subpath without console errors.

The source and web ZIP archives are portable and integrity-checked. The source export's feature tests also passed after extraction using the already installed dependency set. GitHub Pages is configured through the included Actions workflow; deployment status is available in the repository’s Actions tab. Physical-phone/gamepad feel and unrestricted desktop pointer lock still need device verification.
