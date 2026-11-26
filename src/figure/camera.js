// The eye: well back from the wanderer and a little to one side, so the figure sits small in the lower third of the
// canvas and the wood is the picture. It trails softly, stays off the ground and comes in when a trunk is in the way.
import * as THREE from 'three';

const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);

export class Follow {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0; // looks along (sin yaw, 0, cos yaw)
    this.pitch = 0.05; // + looks down on him
    this.want = 6.4;
    this.distance = 6.4;
    this.side = 0.95;
    this.lift = 0.85;
    this.pivot = new THREE.Vector3();
    this.free = null; // { position, target }: a fixed view, for stills
    this.sink = 0; // when the ground lifts the eye, how far the look comes down with it to keep him in the picture (0..1)
  }

  get yaw() { return this._yaw; }
  set yaw(value) { this._yaw = this.aimYaw = value; }
  get pitch() { return this._pitch; }
  set pitch(value) { this._pitch = this.aimPitch = value; }

  look(look, dt = 1 / 60) {
    this.aimYaw -= look.x;
    this.aimPitch = THREE.MathUtils.clamp(this.aimPitch + look.y, -0.75, 1.2);
    // A short, frame-rate independent filter removes mouse-event steps without a long camera trail.
    this._yaw = damp(this._yaw, this.aimYaw, 32, dt);
    this._pitch = damp(this._pitch, this.aimPitch, 32, dt);
    this.lookPrepared = true;
  }

  update(dt, target, look, zoom, castRay, groundAt) {
    const cam = this.camera;
    if (this.free) { cam.position.copy(this.free.position); cam.lookAt(this.free.target); return; }
    if (!this.lookPrepared) this.look(look, dt);
    this.lookPrepared = false;
    this.want = THREE.MathUtils.clamp(this.want + zoom * 0.5, 2.8, 13);
    const goal = new THREE.Vector3(target.x, target.y + 1.35, target.z);
    if (this.pivot.lengthSq() === 0) this.pivot.copy(goal);
    this.pivot.x = damp(this.pivot.x, goal.x, 10, dt);
    this.pivot.z = damp(this.pivot.z, goal.z, 10, dt);
    this.pivot.y = damp(this.pivot.y, goal.y, 5, dt);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const back = new THREE.Vector3(-Math.sin(this.yaw) * cp, sp, -Math.cos(this.yaw) * cp);
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const k = Math.min(1, this.want / 6.4);
    // Keep the shoulder offset outside trunks, then leave clearance around the camera.
    const shoulder=this.side*k,sign=Math.sign(shoulder)||1;
    const sideHit=castRay(this.pivot,right.clone().multiplyScalar(sign),Math.abs(shoulder)+.25);
    const side=sideHit==null?shoulder:sign*Math.min(Math.abs(shoulder),Math.max(0,sideHit-.3));
    const from = this.pivot.clone().addScaledVector(right,side);
    let hit=null;
    for(const offset of [new THREE.Vector3(),right.clone().multiplyScalar(.25),right.clone().multiplyScalar(-.25),new THREE.Vector3(0,.2,0),new THREE.Vector3(0,-.2,0)]){
      const d=castRay(from.clone().add(offset),back,this.want+.4);
      if(d!=null&&(hit==null||d<hit))hit=d;
    }
    const free = hit == null ? this.want : Math.max(0.8, hit - 0.3);
    this.distance = free < this.distance ? damp(this.distance, free, 18, dt) : damp(this.distance, free, 2.5, dt);
    cam.position.copy(from).addScaledVector(back, this.distance);
    const floor = groundAt(cam.position.x, cam.position.z) + 0.45;
    let raised = 0;
    if (cam.position.y < floor) { raised = floor - cam.position.y; cam.position.y = floor; }
    cam.lookAt(from.x - back.x * 6, from.y - back.y * 6 + this.lift * k - raised * this.sink, from.z - back.z * 6);
  }
}
