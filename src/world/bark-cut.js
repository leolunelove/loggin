// Dimensions are half lengths in metres. Older camps used a broad horizontal notch.
export function cutShape(radius,damage,hard=false,aimed=false){
  const d=Math.max(0,Math.min(1,damage));
  if(aimed)return {width:.147+.14*d,height:.026+.058*d,depth:Math.min(radius*(hard?.78:.64),.026+d*(hard?.27:.20))};
  return {width:Math.min(radius*.98,.09+d*.48),height:.045+d*.15,depth:Math.min(radius*(hard?.78:.64),.025+d*(hard?.34:.21))};
}
export function prepareNotch(record,radius,hard){
  const angle=record.angle||0;
  return {...record,...cutShape(radius,record.damage,hard,Number.isFinite(record.angle)),radius,
    cosine:Math.cos(angle),sine:Math.sin(angle)};
}
function coordinates(x,y,z,cut){
  const dx=x-cut.x,dz=z-cut.z,side=dx*cut.nz-dz*cut.nx,rise=y-cut.y;
  const cosine=cut.cosine??Math.cos(cut.angle||0),sine=cut.sine??Math.sin(cut.angle||0);
  return {u:side*cosine+rise*sine,h:rise*cosine-side*sine,front:dx*cut.nx+dz*cut.nz};
}
export function insideNotch(cut,point){
  if(!cut)return false;
  const {u,h,front}=coordinates(point.x,point.y,point.z,cut);
  return Math.abs(h)<=cut.height+.035&&Math.abs(u)<=cut.width+.035&&front<=.075&&front>=-cut.depth-.075;
}
export function notchAt(tree,point){
  return tree?.notches?.findLast(c=>insideNotch(c,point))||(insideNotch(tree?.cut,point)?tree.cut:null);
}
export function cutSample(x,y,z,cut){
  const {u,h,front}=coordinates(x,y,z,cut);
  if(front<-.7*cut.radius||Math.abs(u)>=cut.width||Math.abs(h)>=cut.height)return {depth:0,h,u,along:0};
  const along=1-(u/cut.width)**4,across=1-Math.abs(h)/cut.height;
  const du=-4*(u/cut.width)**3/cut.width*cut.depth*across,dh=-Math.sign(h)*cut.depth/cut.height*along;
  const c=cut.cosine??Math.cos(cut.angle||0),s=cut.sine??Math.sin(cut.angle||0);
  return {depth:cut.depth*along*across,h,u,along,sideSlope:du*c-dh*s,riseSlope:du*s+dh*c};
}
export function deepestCut(x,y,z,cuts){
  let best=null;
  for(const cut of cuts){
    if(Math.abs(y-cut.y)>cut.width+cut.height)continue;
    const sample=cutSample(x,y,z,cut);
    if(sample.depth>(best?.depth||0))best={...sample,cut};
  }
  return best;
}
function recordOf({x,y,z,nx,nz,angle,damage}){
  const record={x,y,z,nx,nz,damage};if(Number.isFinite(angle))record.angle=angle;
  return record;
}
// Preserve the original mouth when the edge bites into an existing hollow.
// Crossing the same spot at a different angle opens a second set of cut faces.
export function recordBarkStrike(tree,point,nx,nz,line,damage,screenPlane){
  const old=tree.notches||[],outer=notchAt(tree,point);
  if(outer){nx=outer.nx;nz=outer.nz;}
  // The actual contact can land around a bend from the mark. Intersect the
  // committed screen plane with this patch's uncut face to retain its slope.
  const side=screenPlane?screenPlane.y:(line?line.x*nz-line.z*nx:0);
  const rise=screenPlane?nx*screenPlane.z-nz*screenPlane.x:line?.y;
  const angle=line?Math.atan2(rise,side):undefined;
  const match=old.findLast(c=>insideNotch(c,point)&&Math.abs(Math.cos((c.angle||0)-(angle||0)))>Math.cos(Math.PI/15));
  const records=old.filter(c=>c!==match).map(recordOf);
  if(match)records.push({...recordOf(match),damage:Math.min(1,match.damage+damage)});
  else{
    const front=outer?(point.x-outer.x)*nx+(point.z-outer.z)*nz:0;
    records.push(recordOf({x:point.x-nx*front,y:point.y,z:point.z-nz*front,nx,nz,angle,damage}));
  }
  return {records,precise:!!match};
}
