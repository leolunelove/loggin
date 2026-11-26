# Loggin’ motion review

The old turning had two separate discontinuities: mouse deltas changed camera yaw immediately, while the stationary body waited until the camera was 1.15 radians (66 degrees) away before playing a fixed turn clip. Starting a chop then assigned the target angle directly to both player yaw fields. That produced camera steps, a delayed body response, and a snap into each tree.

The old swing rotated only the right upper arm, forearm and one spine joint. The axe followed the wrist position but used the character's rotation plus an independent angle, so its orientation did not follow the gripping hand. Its blade also never targeted the cut point: damage and chips were placed at a fixed trunk height while the tool followed a different arc. The 1.85 m reach exceeded what the model's roughly 53 cm arm and axe could physically cover. Removing the swing state immediately returned the tool to carry, causing another snap on cancellation.

The revised camera smooths mouse input with a short exponential filter (32 per second), preserving total input and sensitivity. Movement and targeting use the filtered heading in the same frame. The stationary body follows continuously, with a small allowance for head movement. Chopping requests a gradual facing change and begins when aligned.

The revised chop positions the axe first and solves both arms to palm grips on its handle, preserving bone lengths. The left hand gathers during the raise, slides down for impact, and releases during recovery. Three spine joints share the load and follow-through. A longer lower handle gives the rear hand a proper grip. The blade touches the same world point used for the notch, chips and hit sound, with a dedicated contact frame even at low frame rates or maximum swing speed. Physical reach is now 1.3 m from the bark. Idle carry follows the wrist's position and orientation; interrupted poses blend back over 140 ms.

Validation: automated checks cover 30/60/120 fps camera convergence, shortest-path body turning, gradual chop alignment, contact timing at the fastest upgrade, real character arm lengths, grips and blade position across three distances, two orientations and base/maximum axe sizes, plus cancellation continuity. The local browser review checks raise, windup, contact and pull-out from a side camera, with zero displayed grip and blade-to-cut error at the starter tree's contact pose. Normal-speed keyboard chopping, mouse turning and walking were also exercised without console errors. The existing storage, economy, sound, input and save checks remain in the suite. Physical touch/gamepad feel and unrestricted desktop pointer lock still need device verification.

`tools/motion-review.html` is a local development review page with static poses, slow playback, side/rear views and geometric measurements. It is not included in the production build and disables damage/saving inside its own review frame.

## Swing variations and further refinements

Three forms now vary the shoulder load, swing plane, hand spacing and extraction: overhead, diagonal and compact. Weighted selection avoids adjacent repeats, favouring compact motions for birch and diagonal ones for thick trunks. Every form keeps the same cadence, damage and impact phase. The strike has a stronger drive and pull-out when it will finish the tree.

A small hip settle and forward weight shift bend the knees while the leg solver holds the previously placed feet. During the short contact hold the body absorbs the hit while the axe stays at the cut. Free windups fit to both arms to account for camera-driven shoulder posture. Windups were adjusted after visual review to improve clearance around the hat. The final strike now completes its recovery after a tree disappears from targeting, fixing a cancellation that previously cut off finishing follow-through. Movement remains an immediate interrupt. Normal hits throw smaller chip bursts, while finishing hits throw more and larger pieces.

The geometric checks cover every form, base/maximum axe sizes, normal/finishing hits and multiple distances/headings. Browser review checks diagonal and compact windups, both grips and the cut position, then two trees at normal speed.

The next useful improvements would be more convincing progressive bark removal, visibly distinct upgraded axe heads, and an actual transfer gesture when unloading at the shack. These were completed in the following camp polish pass: real trunk carving, five tool models and animated bundle transfer. The existing economy, controls and painted forest remain.
