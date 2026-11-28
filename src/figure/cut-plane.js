import * as THREE from 'three';

export const ANGLE_STEP=Math.PI/12;
export const wrapCutAngle=angle=>((angle%Math.PI)+Math.PI)%Math.PI;

// A screen line and the camera ray span a plane. Its intersection with the
// bark gives a direction that still looks correct on an oblique or leaning bole.
export function setCutPlane(sight,camera,angle){
  const ray=camera.getWorldDirection(new THREE.Vector3());
  const face=sight.mouthNormal?.clone()||sight.normal?.clone()||ray.clone().negate();
  const screen=new THREE.Vector3(Math.cos(angle),Math.sin(angle),0).applyQuaternion(camera.quaternion);
  const into=ray.dot(face);
  const tangent=Math.abs(into)>.12?screen.clone().addScaledVector(ray,-screen.dot(face)/into):screen.clone().projectOnPlane(face);
  if(tangent.lengthSq()<.0001)tangent.copy(screen);
  sight.screenPlaneNormal=screen.clone().cross(ray).normalize();
  sight.cutLine=tangent.normalize();sight.cutFace=face.normalize();sight.screenAngle=angle;
  return sight;
}

// Local X points from the eye of the axe to its bit. Local Y runs up the
// handle. Both stay in the chosen cutting plane as the two hands drive it.
export function toolInCutPlane(inward,along,tilt){
  const bit=inward.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(along,-Math.sin(tilt));
  const shaft=along.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(inward,Math.sin(tilt));
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(bit,shaft,bit.clone().cross(shaft)));
}
