# Woodsmoke gameplay and usability pass

This is a hands-on agent review plus code and regression checks, not a study with recruited players. No participant reactions or satisfaction scores are claimed.

## Prompts applied

1. [Usability Test Script](https://aiuxplayground.com/prompts/usability-test-script): shortened to the first five minutes and the core chop → earn → upgrade → resume loop.
2. [Polish UI motion](https://aiuxplayground.com/prompts/polish-ui-motion): small menu/control feedback, plus a separate gameplay-feel pass on tool contact, bark cuts, chips, timber sounds, and falling trees.
3. [Unslop my UI](https://aiuxplayground.com/prompts/unslop-my-ui): removed repeated slogans and routine instructions; kept the reference-compatible palette and typography.
4. [Design Completeness Checklist](https://aiuxplayground.com/prompts/design-completeness-checklist): input transitions, menu focus, disabled purchases, save failure and backup recovery, loading recovery, reduced motion and narrow layouts. Irrelevant forms, pagination, account creation and game-over states are out of scope.
5. [Create a DESIGN.md](https://aiuxplayground.com/prompts/create-design-md): recorded the retained visual direction, controls, economy boundaries, motion and verification rules in DESIGN.md.

## Five-minute playtest protocol

- 0:00–0:45: Enter the forest, look around without a held button, move and strafe, stop, sprint.
- 0:45–1:30: Chop the starting birch. Check that the axe contact, health, sound trigger and chips occur together. Move during windup and confirm movement wins immediately.
- 1:30–2:30: Walk to another visible tree. Stand against its side and verify the label and chopping remain available. Look away and verify it is not damaged accidentally.
- 2:30–3:30: Open upgrades. Understand what the first axe changes and how much wood is missing. Earn it and buy it.
- 3:30–4:30: Resume, chop again and compare the number of swings. Release the cursor with Esc, open settings, adjust sensitivity, use Tab, and resume.
- 4:30–5:00: Reload and confirm wood, tools and preferences persist.

For a human playtest, observe unaided completion, hesitation, missed targets, unwanted actions and reasons to stop. Ask whether an upgrade makes the next tree feel better. Do not substitute a simulated persona for a real participant.

## Findings and implementation

| Finding | Result |
| --- | --- |
| Closest-tree targeting can choose an offscreen trunk | Selection follows the camera view and favours reach |
| A narrow character-facing cone loses a visible trunk at close range | Visibility uses the camera origin, so a trunk beside the walker remains selectable |
| Swings block movement until recovery ends | Movement immediately cancels the swing; no uncommitted damage |
| Impact timing lacks a clear contact beat | Windup, fast strike, 5% contact hold and recovery share one cadence; damage/sound/chips sync at 50% |
| No persistent sign of a partly cut trunk | A small cut grows with damage |
| Fallen tree vanishes abruptly | The canopy settles away and leaves painted log sections beside the stump |
| Shoulder camera can be placed inside a nearby trunk | Shoulder clearance and five camera rays reduce clipping while retaining clear-space framing |
| Axe strength is abstract | Upgrades show chops per beech before and after |
| Disabled prices give little guidance | Each states how much more wood is needed |
| Repeated atmospheric copy competes with play | Removed routine slogans/toasts and out-of-reach chop prompts |
| Fixed mouse sensitivity | Saved sensitivity control added |
| Tab is swallowed by gameplay input | Menus retain native keyboard navigation |
| Damaged or unavailable storage is poorly explained | Backup recovery and honest save status added; failure does not stop play |
| Loading failure only says to reload | Added a reload action |

Automated checks cover actual swing cancellation and single-hit rules, targeting, close-range selection, first-upgrade economy, save recovery/quota failures, mouse input transitions and camera clearance. Browser observations and remaining verification limits are recorded with the release result. Audio synthesis changed; final listening quality and physical-phone/gamepad feel still require human checks. The embedded preview does not verify native unlimited pointer lock.

## Verified release checks

- 14 automated checks passed, including real gameplay-method cancellation and single-hit behavior, selection at the side of a trunk, clear-space framing and trunk clearance, save backup recovery, backup quota failure, and input isolation.
- Production build passed; static payload remains about 8.5 MB, with no external runtime assets.
- Embedded desktop browser: birch chopping by mouse and keyboard, two consecutive trees, close-range selection, wood rewards, felling axe purchase, U / Esc / Resume, Tab to the sensitivity slider, and a keyboard sensitivity change all passed.
- Reload retained 12 wood, the felling axe and 1.05× sensitivity. No browser errors or warnings were recorded in that run.
- Settings fit a 390px layout: document width 390px, dialog width 358px, and no horizontal overflow inside the dialog. Temporary viewport override was reset. This is layout verification, not a physical-phone test.
- Tree label placement is clamped inside the viewport so edge labels remain readable.

Remaining human checks: listening to the revised timber sounds, native unlimited pointer-lock feel in a standard browser, physical-phone touch feel and physical gamepad feel.
