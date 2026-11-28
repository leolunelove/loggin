// Keyboard, mouse and gamepad, read once a frame into one plain state.
//   move: {x, y} (x right, y forward, length 0..1), walk, sprint, strafe (held),
//   jump (pressed this frame), look: {x, y} (radians this frame), zoom (wheel steps this frame)
import {ANGLE_STEP,wrapCutAngle} from './cut-plane.js';

export class Input {
  constructor(el, { pads = true } = {}) {
    this.el = el;
    this.pads = pads; // off in headless checks: this PC's real gamepad shows up in headless browsers too
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, wheel: 0, left: false, right: false };
    this.cutAngle=0;
    this.clickAngle=null;
    this.walkToggle = false;
    this.pad = { a: false, l3: false, sprint: false };
    this.sensitivity = 0.0022;
    this.override = null; // scripted input for captures
    this.lockable = false;
    this.freeLook = false;
    this.requestPending = false;
    this.touchMove = {x:0, y:0};
    this.touchLook = {x:0, y:0};
    const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    const down = (e) => {
      if (typing()) return;
      if (e.code === 'Escape' && this.freeLook) { this.release(); return; }
      if (!this.lockable || !this.active) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'AltLeft', 'AltRight'].includes(e.code)) e.preventDefault();
      if(this.mouse.right&&(e.code==='KeyZ'||e.code==='KeyC')){
        this.cutAngle=wrapCutAngle(this.cutAngle+(e.code==='KeyZ'?1:-1)*Math.PI/90);
        e.preventDefault();
      }
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'CapsLock' && !e.repeat) this.walkToggle = !this.walkToggle;
    };
    const up = (e) => this.keys.delete(e.code);
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    addEventListener('blur', () => this.release());
    el.addEventListener('mousedown', (e) => {
      if (!this.lockable) return;
      // The click that recaptures the mouse only resumes the game. Subsequent clicks swing the axe.
      if (!this.active) { if (e.button === 0) this.capture(); return; }
      if (e.button === 0) {
        if(!this.mouse.left){this.pressed.add('Interact');this.clickAngle=this.mouse.right?this.cutAngle:null;}
        this.mouse.left = true;
      }
      if (e.button === 2) this.mouse.right = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    document.addEventListener('pointerlockchange', () => { this.requestPending = false; this.freeLook = false; this.clear(); });
    document.addEventListener('pointerlockerror', () => this.fallback());
    el.addEventListener('mouseleave', () => { if (this.freeLook) this.release(); });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (this.active && this.lockable) { this.mouse.x += e.movementX; this.mouse.y += e.movementY; }
    });
    el.addEventListener('wheel', (e) => {
      if(this.active&&this.lockable&&this.mouse.right&&!e.altKey){
        // Line-mode wheels usually send three lines per notch. Pixel-mode
        // trackpads send much smaller deltas and can turn the edge continuously.
        const unit=e.deltaMode===1?3:e.deltaMode===2?1:100;
        const steps=Math.max(-3,Math.min(3,e.deltaY/unit));
        this.cutAngle=wrapCutAngle(this.cutAngle-steps*ANGLE_STEP);
      }else this.mouse.wheel+=Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
  }

  get locked() { return document.pointerLockElement === this.el; }
  get active() { return this.locked || this.freeLook; }

  clear() {
    this.keys.clear(); this.pressed.clear(); this.clickAngle=null;
    this.mouse.x = this.mouse.y = this.mouse.wheel = 0;
    this.mouse.left = this.mouse.right = false;
    this.touchMove.x = this.touchMove.y = this.touchLook.x = this.touchLook.y = 0;
  }

  capture() {
    if (!this.lockable || this.active) return;
    this.requestPending = true;
    if (!this.el.requestPointerLock) { this.fallback(); return; }
    try { this.el.requestPointerLock()?.catch?.(() => this.fallback()); }
    catch { this.fallback(); }
  }

  // Embedded browsers can deny pointer lock. Relative mouse movement still works without dragging.
  fallback() {
    if (!this.lockable || !this.requestPending || this.locked) return;
    this.requestPending = false; this.clear(); this.freeLook = true;
    document.dispatchEvent(new Event('woodsmoke:mousecapturechange'));
  }

  release() {
    this.requestPending = false; this.freeLook = false; this.clear();
    if (this.locked) document.exitPointerLock?.();
    document.dispatchEvent(new Event('woodsmoke:mousecapturechange'));
  }

  read(dt) {
    if (this.override) return this.override(dt);
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    const s = {
      move: { x: x || this.touchMove.x, y: y || this.touchMove.y },
      walk: this.walkToggle !== (k.has('AltLeft') || k.has('AltRight')),
      sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
      strafe: this.active || k.has('KeyF'),
      jump: this.pressed.has('Space') || this.pressed.has('Jump'),
      gatherPressed:this.pressed.has('KeyE')||this.pressed.has('Gather'),
      interactPressed:this.pressed.has('KeyE')||this.pressed.has('Interact'),
      chopPressed:this.pressed.has('KeyE')||this.pressed.has('Interact'),
      swingPressed:this.pressed.has('Interact'),
      fieldPressed:this.pressed.has('KeyR'),
      aimHeld: this.active && this.mouse.right,
      cutAngle:this.cutAngle,clickAngle:this.clickAngle,
      aimPressed: this.pressed.has('KeyQ'),
      look: { x: this.mouse.x * this.sensitivity + this.touchLook.x, y: this.mouse.y * this.sensitivity + this.touchLook.y },
      zoom: this.mouse.wheel,
      device: 'keyboard',
    };
    this.mouse.x = this.mouse.y = this.mouse.wheel = 0;
    this.pressed.clear();this.clickAngle=null;
    this.touchLook.x = this.touchLook.y = 0;

    // gamepad: left stick moves (its tilt sets the speed), right stick looks, L3 sprints,
    // A jumps, LT strafes, d-pad up/down zooms
    const pad = this.pads ? [...(navigator.getGamepads?.() ?? [])].find((p) => p && p.connected) : null;
    if (pad) {
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : Math.sign(v) * (Math.abs(v) - 0.15) / 0.85);
      let px = dz(pad.axes[0] ?? 0), py = -dz(pad.axes[1] ?? 0);
      const pl = Math.hypot(px, py);
      if (pl > 1) { px /= pl; py /= pl; }
      const btn = (i) => !!pad.buttons[i]?.pressed;
      if (pl > 0.01) { s.move = { x: px, y: py }; s.device = 'pad'; s.walk = false; }
      const rx = dz(pad.axes[2] ?? 0), ry = dz(pad.axes[3] ?? 0);
      s.look.x += rx * Math.abs(rx) * 3.2 * dt;
      s.look.y += ry * Math.abs(ry) * 2.2 * dt;
      if (btn(10) && !this.pad.l3) this.pad.sprint = !this.pad.sprint;
      if (pl < 0.2) this.pad.sprint = false;
      if (this.pad.sprint || btn(5)) s.sprint = true;
      if (btn(0) && !this.pad.a) s.jump = true;
      const aim=(pad.buttons[6]?.value??0)>.4;
      if(aim){s.strafe=true;s.aimHeld=true;}
      if(btn(11)&&!this.pad.lock)s.aimPressed=true;
      this.pad.lock=btn(11);
      if(aim&&(btn(14)||btn(15))){
        this.cutAngle=wrapCutAngle(this.cutAngle+((btn(14)?1:0)-(btn(15)?1:0))*dt*Math.PI*.55);
        s.cutAngle=this.cutAngle;
      }
      if (btn(12)) s.zoom -= 4 * dt;
      if (btn(13)) s.zoom += 4 * dt;
      this.pad.a = btn(0); this.pad.l3 = btn(10);
      if(btn(3)&&!this.pad.gather){s.gatherPressed=true;s.device='pad';}
      this.pad.gather=btn(3);
      if (btn(2) && !this.pad.swing) s.swingPressed = true;
      this.pad.swing = btn(2);
      if (rx || ry || pl > 0.01 || aim || btn(11) || btn(0) || btn(2) || btn(7)) s.device = 'pad';
    }
    return s;
  }
}
