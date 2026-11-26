# Sound pass — November 26, 2026

The former axe and landing effects used a pitch-swept triangle oscillator plus filtered ambience noise. They have been replaced with real field recordings, edited into a small local sound bank.

- Four axe takes, loudness matched to within about 0.5 dB RMS, with no immediately repeated take and small playback-rate differences.
- Contact transients trimmed to under 1 ms before audible onset. Samples are fetched during loading and decoded on the first user gesture, before the first swing reaches contact.
- The last chop has more weight and a separate trunk split. A continuous rushing crown grows with the visual fall and fades out at impact.
- The landing uses the recording's lower-frequency forest-floor impact, separate from its sharper trunk crack. It starts on the frame the trunk reaches a terrain-derived contact angle. Heavier trees take longer to fall and use a lower landing pitch.
- An interactive audio context, source-distance/pan, quieter ambience and bird calls, and a compressor provide headroom without the former thin synthetic hit tone.
- Existing Sound on/off preference applies to all sounds. Missing audio is nonfatal and reported; progress, controls and upgrade prices are preserved.

## Asset provenance

See public/audio/CREDITS.md. Source pages explicitly identify both recordings as CC0. All seven WAV clips total about 236 KB; gameplay never calls an external audio service. The short sound-check WAV alongside the project is an authored demonstration of the layers, not a recording of a browser session.

## Verification

20 tests pass, including decoded sample playback, no oscillator-based hit, nonrepeating takes, immediate attacks, one landing only, mute, missing assets, and terrain contact on uphill/flat/downhill ground. The production build passes. Local browser chopping and a complete fall run without audio errors or warnings. Browser playback/output quality is not equivalent to a human headphone listening sign-off.
