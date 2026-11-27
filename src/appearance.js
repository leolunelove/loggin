export const OUTFITS={
 shirt:[['Oat',[.64,.54,.45]],['Rust',[.60,.22,.13]],['Pine',[.22,.37,.27]],['Indigo',[.24,.33,.49]]],
 hat:[['Straw',[.80,.62,.32]],['Walnut',[.35,.22,.14]],['Moss',[.32,.39,.23]],['Charcoal',[.23,.25,.25]]],
 pack:[['Blue',[.11,.27,.52]],['Canvas',[.58,.45,.26]],['Forest',[.20,.32,.23]],['Oxide',[.49,.23,.16]]],
 skin:[['Light',[.86,.64,.47]],['Warm',[.67,.43,.29]],['Brown',[.43,.27,.18]],['Deep',[.25,.15,.11]]],
 hair:[['Chestnut',[.30,.17,.10]],['Black',[.10,.08,.075]],['Silver',[.55,.53,.47]],['Ginger',[.57,.27,.10]]]
};
export const CUTS={headwear:['Field brim','Watch cap','Rail cap'],workwear:['Work shirt','Quilted vest','Mill apron']};
export const defaultAppearance=()=>({shirt:0,hat:0,pack:0,skin:0,hair:0,headwear:0,workwear:0});
export function sanitizeAppearance(value){const out=defaultAppearance();for(const k of Object.keys(out))out[k]=Math.max(0,Math.min((OUTFITS[k]||CUTS[k]).length-1,Math.floor(Number(value?.[k])||0)));return out;}
const palette=c=>[c.map(v=>Math.min(1,v*1.35+.12)),c,c.map(v=>v*.45)];
export function characterPalettes(appearance){const a=sanitizeAppearance(appearance);return Object.fromEntries(Object.entries(OUTFITS).map(([k,values])=>[k.toUpperCase(),palette(values[a[k]][1])]));}
