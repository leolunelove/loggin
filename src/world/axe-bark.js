import * as THREE from 'three';
import {BARK_GROUPS,TRUNK_GROUPS} from './woodland-physics.js';

// Only axe queries see the detailed, concave bark. Feet and camera retain the solid
// trunk hull, so an expanding notch never catches the character controller.
export class NearbyBark {
  constructor(world,R,forest){Object.assign(this,{world,R,forest});this.active=new Set();this.last=null;}
  update(feet){
    if(this.last&&this.last.distanceToSquared(feet)<.45*.45)return;
    (this.last??=new THREE.Vector3()).copy(feet);
    for(const tree of this.active){
      if(tree.down||Math.hypot(tree.x-feet.x,tree.z-feet.z)>tree.r+3.2)this.remove(tree);
    }
    for(const tree of this.forest.colliders){
      if(tree.down||!tree.collider||this.active.has(tree)||Math.hypot(tree.x-feet.x,tree.z-feet.z)>tree.r+2.6)continue;
      this.forest.setBarkDetail?.(tree,true);
      const {vertices,indices}=this.forest.barkSurface(tree);
      const desc=this.R.ColliderDesc.trimesh(vertices,indices,this.R.TriMeshFlags.FIX_INTERNAL_EDGES)
        .setTranslation(tree.x,tree.y,tree.z).setCollisionGroups(BARK_GROUPS);
      tree.axeBark=this.world.createCollider(desc);tree.axeBark.standingTree=tree;
      tree.collider.setCollisionGroups(TRUNK_GROUPS);this.active.add(tree);
    }
  }
  recut(tree){
    if(!tree.axeBark)return;
    const {vertices,indices}=this.forest.barkSurface(tree);
    tree.axeBark.setShape(new this.R.TriMesh(vertices,indices,this.R.TriMeshFlags.FIX_INTERNAL_EDGES));
  }
  remove(tree){
    if(!this.active.delete(tree))return;
    this.world.removeCollider(tree.axeBark,false);tree.axeBark=null;
    tree.collider?.setCollisionGroups(0xffffffff);
    if(!tree.down)this.forest.setBarkDetail?.(tree,false);
  }
}
