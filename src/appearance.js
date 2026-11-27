export const OUTFITS={
 shirt:[['Oat',[.66,.575,.43]],['Rust',[.60,.22,.13]],['Pine',[.22,.37,.27]],['Indigo',[.24,.33,.49]]],
 hat:[['Straw',[.69,.515,.305]],['Walnut',[.35,.22,.14]],['Moss',[.32,.39,.23]],['Charcoal',[.23,.25,.25]]],
 pack:[['Blue',[.29,.365,.416]],['Canvas',[.58,.45,.26]],['Forest',[.20,.32,.23]],['Oxide',[.49,.23,.16]]],
 skin:[['Light',[.86,.64,.47]],['Warm',[.67,.43,.29]],['Brown',[.43,.27,.18]],['Deep',[.25,.15,.11]]],
 hair:[['Chestnut',[.30,.17,.10]],['Black',[.10,.08,.075]],['Silver',[.55,.53,.47]],['Ginger',[.57,.27,.10]]]
};
export const CUTS={headwear:['Field brim','Watch cap','Rail cap'],workwear:['Work shirt','Quilted vest','Mill apron'],beard:['Clean shaven','Stubble','Short beard']};
export const defaultAppearance=()=>({shirt:0,hat:0,pack:0,skin:0,hair:0,headwear:0,workwear:0,beard:0});
export function sanitizeAppearance(value){const out=defaultAppearance();for(const k of Object.keys(out))out[k]=Math.max(0,Math.min((OUTFITS[k]||CUTS[k]).length-1,Math.floor(Number(value?.[k])||0)));return out;}
// Mix a warm lit surface and a cooler shade from each selected dye. Even the
// dark values retain their hue in the shade of the brim and under the pack.
function palette(kind,c) {
  const skin=kind==='skin',hair=kind==='hair';
  const sunlight=skin?[.95,.73,.55]:[.88,.78,.61];
  const reflected=skin?[.275,.184,.163]:[.225,.215,.232];
  const highlight=skin?.32:hair?.17:.31;
  const light=c.map((v,k)=>v+(sunlight[k]-v)*highlight+.028);
  const dark=c.map((v,k)=>v*(skin?.53:.57)+reflected[k]*(hair?.09:skin?.23:.19));
  return [light,c,dark];
}
export function characterPalettes(appearance){
  const a=sanitizeAppearance(appearance);
  return Object.fromEntries(Object.entries(OUTFITS).map(([k,values])=>[k.toUpperCase(),palette(k,values[a[k]][1])]));
}
