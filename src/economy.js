export const AXES = [
  { name: 'Hand axe', power: 1, cost: 0 },
  { name: 'Felling axe', power: 2, cost: 12 },
  { name: 'Steel axe', power: 3.5, cost: 45 },
  { name: 'Splitting axe', power: 6, cost: 130 },
  { name: "Forester’s axe", power: 10, cost: 320 },
];
export const TREES = [
  { name: 'Beech', health: 6, wood: 14 },
  { name: 'Birch', health: 3, wood: 8 },
  { name: 'Old oak', health: 16, wood: 45 },
  { name: 'Maple', health: 9, wood: 22 },
];
export const freshState = () => ({ version: 1, wood: 0, carried: 0, total: 0, felled: 0, axe: 0, speed: 0, yield: 0, sound: true, low: false, sensitivity: 1, down: {} });
export function sanitize(data) {
  const s = freshState();
  // Existing balances remain stored at the shack. New harvests travel in the bag.
  for (const k of ['wood','carried','total','felled']) s[k] = Math.max(0, Math.min(1e12, Math.floor(Number(data?.[k]) || 0)));
  for (const [k,max] of [['axe',4],['speed',4],['yield',4]]) s[k] = Math.max(0, Math.min(max, Math.floor(Number(data?.[k]) || 0)));
  for (const k of ['sound','low']) if (typeof data?.[k] === 'boolean') s[k] = data[k];
  s.sensitivity = Math.max(.5, Math.min(2, Number(data?.sensitivity) || 1));
  for (const [k,v] of Object.entries(data?.down || {})) if (/^\d{1,5}$/.test(k) && Number.isFinite(v) && v > Date.now()) s.down[k] = Math.min(v, Date.now()+90000);
  return s;
}
export function upgradeCost(s, kind) {
  if (kind === 'axe') return AXES[s.axe + 1]?.cost ?? null;
  if (!['speed','yield'].includes(kind) || s[kind] >= 4) return null;
  return Math.round((kind === 'speed' ? 18 : 20) * 2.7 ** s[kind]);
}
export function purchase(s,kind) {
  const cost=upgradeCost(s,kind);
  if (cost === null || s.wood < cost) return false;
  s.wood -= cost; s[kind]++; return true;
}
export function depositWood(s,requested=s.carried) {
  const amount=Math.min(s.carried,Math.max(0,requested),Math.max(0,1e12-s.wood));
  if(amount<=0)return 0;
  s.wood+=amount;s.carried-=amount;return amount;
}
export const swingDuration = s => .94 * .86 ** s.speed;
export const rewardFor = (s, type) => Math.round(TREES[type].wood * (1 + s.yield * .3));
