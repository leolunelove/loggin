// A V-shaped bite in the trunk, measured in the cut's normal/tangent frame.
export function cutShape(radius,damage,hard=false){
 const d=Math.max(0,Math.min(1,damage));
 return {width:Math.min(radius*.98,.09+d*.48),height:.045+d*.15,depth:Math.min(radius*(hard?.78:.64),.025+d*(hard?.34:.21))};
}
export function insideNotch(cut,point){
 if(!cut)return false;
 const dx=point.x-cut.x,dz=point.z-cut.z;
 const sideways=-dx*cut.nz+dz*cut.nx,front=dx*cut.nx+dz*cut.nz;
 return Math.abs(point.y-cut.y)<=cut.height+.035&&Math.abs(sideways)<=cut.width+.035&&front<=.075&&front>=-cut.depth-.075;
}
export function cutSample(x,y,z,cut){
 const dx=x-cut.x,dz=z-cut.z,u=dx*(-cut.nz)+dz*cut.nx,h=y-cut.y,front=dx*cut.nx+dz*cut.nz;
 const along=Math.max(0,1-(u/cut.width)**4),vertical=Math.max(0,1-Math.abs(h)/cut.height);
 const depth=front>-.7*cut.radius?cut.depth*along*vertical:0;
 return {depth,h,u,along};
}
