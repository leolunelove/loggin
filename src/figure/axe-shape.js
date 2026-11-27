// Dimensions are in the tool's local space. The renderer and the held-tool collider
// use the same stock, including each sharpened bevel and the swell at the heel.
export const AXE_PROFILES = [
  {wood:[[.7,.47,.25],[.38,.25,.16],[.18,.14,.12]],steel:[[.63,.69,.67],[.32,.38,.39],[.15,.19,.21]],depth:.048,wrap:0,
    points:[[-.071,.492],[.035,.489],[.178,.456],[.263,.433],[.296,.469],[.315,.525],[.311,.58],[.29,.635],[.194,.616],[.067,.595],[-.073,.601]]},
  {wood:[[.94,.73,.4],[.56,.35,.19],[.23,.18,.17]],steel:[[.77,.84,.80],[.38,.47,.47],[.17,.23,.25]],depth:.056,wrap:.13,
    points:[[-.087,.489],[.014,.487],[.111,.47],[.158,.431],[.174,.387],[.247,.365],[.291,.419],[.315,.525],[.305,.611],[.283,.675],[.199,.654],[.047,.615],[-.089,.619]]},
  {wood:[[.79,.56,.3],[.38,.23,.14],[.16,.13,.11]],steel:[[.84,.88,.84],[.43,.53,.55],[.19,.25,.29]],depth:.061,wrap:.24,
    points:[[-.142,.496],[-.042,.486],[.028,.457],[.095,.457],[.176,.403],[.253,.385],[.289,.441],[.315,.525],[.304,.609],[.277,.686],[.188,.658],[.112,.626],[.003,.622],[-.139,.614]]},
  {wood:[[.68,.39,.24],[.32,.19,.14],[.14,.12,.12]],steel:[[.73,.79,.79],[.37,.43,.45],[.16,.21,.25]],depth:.089,wrap:.32,
    points:[[-.171,.478],[-.088,.478],[-.051,.498],[.045,.477],[.151,.435],[.25,.419],[.293,.457],[.315,.525],[.303,.602],[.273,.654],[.169,.638],[.054,.618],[-.057,.609],[-.085,.629],[-.171,.629]]},
  {wood:[[.64,.45,.27],[.32,.24,.17],[.14,.13,.12]],steel:[[.83,.86,.78],[.43,.50,.47],[.18,.25,.25]],depth:.064,wrap:.4,
    points:[[-.258,.402],[-.193,.438],[-.094,.475],[-.026,.484],[.044,.478],[.162,.423],[.254,.381],[.294,.443],[.315,.525],[.310,.609],[.281,.696],[.177,.654],[.055,.605],[-.037,.606],[-.148,.633],[-.25,.671],[-.281,.615],[-.298,.532],[-.288,.463]]},
];
export const LOWER_GRIP = -.27;
const LENGTH=[.82,.89,.94,.98,1];
const HEAD_WIDTH=[.65,.66,.62,.60,.55];
export const toolScale=tier=>LENGTH[tier];
export const headPoint=(tier,x,y)=>[x*HEAD_WIDTH[tier],.54+(y-.54)*.76];
export const bladePoint=tier=>[...headPoint(tier,.315,.525),0];
export const HAFT_RINGS = [
  [-.32,.016,.033,.022],[-.308,.015,.043,.029],[-.277,.001,.042,.029],
  [-.237,-.006,.033,.024],[-.15,-.011,.032,.024],[.015,-.015,.029,.022],
  [.18,-.003,.027,.021],[.34,.01,.03,.023],[.449,.007,.033,.026],
  [.488,.002,.032,.025],[.58,0,.032,.024],[.615,0,.031,.022],
];
export function haftAt(y) {
  const end=HAFT_RINGS.findIndex(r=>r[0]>=y);
  if(end<0)return HAFT_RINGS.at(-1).slice(1);
  if(end===0)return HAFT_RINGS[0].slice(1);
  const a=HAFT_RINGS[end-1],b=HAFT_RINGS[end],t=(y-a[0])/(b[0]-a[0]);
  return a.slice(1).map((v,i)=>v+(b[i+1]-v)*t);
}
export function ringPoints(ring) {
  const [y,x,rx,rz]=ring;
  return Array.from({length:10},(_,i)=>[x+rx*Math.cos(i*Math.PI/5),y,rz*Math.sin(i*Math.PI/5)]);
}
function clipX(poly,x,keepRight) {
  const result=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[(i+poly.length-1)%poly.length],b=poly[i];
    const inside=v=>keepRight?v[0]>=x:v[0]<=x;
    if(inside(a)!==inside(b)){const t=(x-a[0])/(b[0]-a[0]);result.push([x,a[1]+(b[1]-a[1])*t]);}
    if(inside(b))result.push(b);
  }
  return result.filter((p,i)=>Math.hypot(p[0]-result[(i+result.length-1)%result.length][0],p[1]-result[(i+result.length-1)%result.length][1])>1e-7);
}
export function headStock(tier) {
  const {points,depth}=AXE_PROFILES[tier],left=Math.min(...points.map(p=>p[0]));
  // Shoulder, forged cheek, ground bevel and narrow honed edge.
  const stations=tier===4?[[left,.035],[-.28,.20],[-.216,.66],[-.064,1]]:[[left,.78],[left+.019,.94],[-.036,1]];
  stations.push([.045,1],[.158,tier===3?.86:.65],[.232,.47],[.293,.16],[.315,.034]);
  const strips=[];
  for(let i=1;i<stations.length;i++){
    const [a,da]=stations[i-1],[b,db]=stations[i],poly=clipX(clipX(points,a,true),b,false);
    if(poly.length<3)continue;
    const half=x=>(da+(db-da)*(x-a)/(b-a))*depth/2;
    const face=poly.map(([x,y])=>[...headPoint(tier,x,y),half(x)]),back=poly.map(([x,y])=>[...headPoint(tier,x,y),-half(x)]);
    const edge=a>=.232||tier===4&&b<=-.216;
    strips.push({face,back,part:a>=.232?'bit':tier===4&&b<=-.216?'backBit':'head',
      finish:edge?(a>=.293||b<=-.28?'honed':'ground'):'forged'});
  }
  return strips;
}
export function axeSolids(tier) {
  const scale=toolScale(tier),groups=new Map();
  for(const strip of headStock(tier)){
    if(!groups.has(strip.part))groups.set(strip.part,[]);
    groups.get(strip.part).push(...strip.face,...strip.back);
  }
  groups.set('haft',HAFT_RINGS.slice(0,7).flatMap(ringPoints));
  groups.set('neck',HAFT_RINGS.slice(6).flatMap(ringPoints));
  return [...groups].map(([name,raw])=>{
    // Keep origins close to their own material; this matters for rotating sweeps.
    const centre=[0,1,2].map(i=>(Math.min(...raw.map(p=>p[i]))+Math.max(...raw.map(p=>p[i])))*scale/2);
    return {name,centre,vertices:new Float32Array(raw.flatMap(p=>p.map((v,i)=>v*scale-centre[i])))};
  });
}
