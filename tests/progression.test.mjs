import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,sanitize,bagCapacity,canHarvest,packTimber,depositWood,purchase,rewardFor} from '../src/economy.js';
test('a bag accepts each whole piece that fits and refuses to take any part of an oversized one',()=>{
  const s=freshState();assert.equal(bagCapacity(s),24);s.carried=21;
  assert.equal(packTimber(s,4),false);assert.equal(s.carried,21);
  assert.equal(packTimber(s,2),true);assert.equal(s.carried,23);assert.equal(s.total,2);
  assert.equal(packTimber(s,1,true),true);assert.equal(s.carriedHardwood,1);
  assert.equal(packTimber(s,1),false);assert.equal(s.total,3);
});
test('landed deliveries grow camp once, preserve spendable timber, and unlock the larger bag',()=>{const s=freshState();s.carried=24;depositWood(s,16);assert.equal(s.shed,16);assert.equal(s.carried,8);assert.equal(s.wood,16);depositWood(s);s.carried=16;depositWood(s);assert.equal(s.shed,40);assert.equal(s.wood,40);assert.equal(bagCapacity(s),64);depositWood(s);assert.equal(s.shed,40);});
test('hardwood requires both the woodshed and felling axe',()=>{const s=freshState();assert.ok(!canHarvest(s,2));s.shed=40;assert.ok(!canHarvest(s,3));s.axe=1;assert.ok(canHarvest(s,2));assert.ok(canHarvest(s,3));assert.ok(packTimber(s,3,true));});
test('hardwood travels in the same bag, transfers only on landing and funds advanced axes',()=>{const s=freshState();s.shed=40;s.axe=1;s.wood=100;s.carried=22;s.carriedHardwood=22;assert.ok(!purchase(s,'axe'));depositWood(s,10);assert.equal(s.carriedHardwood,12);assert.equal(s.hardwood,10);assert.ok(purchase(s,'axe'));assert.equal(s.hardwood,2);assert.equal(s.carried,12);});
test('legacy overloaded saves retain their wood and new project fields survive sanitization',()=>{const s=sanitize({carried:300,wood:123,shed:40,carriedHardwood:22,hardwood:8});assert.equal(s.carried,300);assert.equal(s.wood,123);assert.equal(s.shed,40);assert.equal(s.carriedHardwood,22);assert.equal(s.hardwood,8);assert.equal(sanitize({}).shed,0);});
test('fully upgraded yield still fits the biggest tree in an expanded bag',()=>{const s={...freshState(),shed:40,axe:4,yield:4};assert.ok(rewardFor(s,2)<=bagCapacity(s));});
