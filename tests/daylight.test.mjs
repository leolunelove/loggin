import test from 'node:test';import assert from 'node:assert/strict';
import {advanceClock,canSleep,sleepUntilMorning,daylightAt,clockLabel,DAY_SECONDS,sleepFade} from '../src/daylight.js';
import {freshState,sanitize} from '../src/economy.js';
test('clock crosses midnight and full cycles without losing fractional time',()=>{const s=freshState();s.hour=23;advanceClock(s,DAY_SECONDS/12);assert.equal(s.day,2);assert.equal(s.hour,1);advanceClock(s,DAY_SECONDS*2);assert.equal(s.day,4);assert.equal(s.hour,1);assert.equal(clockLabel(s),'01:00');});
test('sleep skips evening or pre-dawn to morning and preserves camp resources',()=>{for(const hour of [18,23,0,5]){const s={...freshState(),hour,wood:35,carried:12,planks:8};assert.ok(canSleep(s));assert.ok(sleepUntilMorning(s));assert.equal(s.hour,6.5);assert.equal(s.day,hour>=18?2:1);assert.equal(s.wood,35);assert.equal(s.carried,12);assert.equal(s.planks,8);assert.equal(sleepUntilMorning(s),false);}});
test('daylight remains continuous across midnight and sleep fades fully black',()=>{assert.equal(daylightAt(12).daylight,1);assert.equal(daylightAt(0).daylight,0);assert.deepEqual(daylightAt(0),daylightAt(24));assert.equal(sleepFade(0),0);assert.equal(sleepFade(.8),1);assert.equal(sleepFade(2),0);});

test('old saves start in daylight and saved clock values survive reload',()=>{assert.equal(sanitize({version:1,wood:20}).hour,9);const s=sanitize({...freshState(),day:8,hour:22.75});assert.equal(s.day,8);assert.equal(s.hour,22.75);assert.equal(sanitize({hour:NaN}).hour,9);});
