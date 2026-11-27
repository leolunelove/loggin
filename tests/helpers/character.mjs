import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

const loadModel=async name=>{
 const bytes=await fs.readFile(new URL('../../public/figure/'+name,import.meta.url));
 return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
};
const [model,animations,hands]=await Promise.all([loadModel('starter-man.glb'),loadModel('starter-man-clips.glb'),
 fs.readFile(new URL('../../src/figure/hands-anymove.json',import.meta.url),'utf8').then(JSON.parse)]);
const raw={},clips={},motion={};
for(const clip of animations.animations){
 raw[clip.name]=clip;clips[clip.name]=new THREE.AnimationClip(clip.name,clip.duration,clip.tracks.filter(t=>!t.name.startsWith('root.')));
 motion[clip.name]={speed:1,velocity:new THREE.Vector3(),yaw:0,duration:clip.duration};
}
export function character(){
 const object=clone(model.scene),bones={};object.traverse(o=>{if(o.isBone)bones[o.name]=o;});
 return {object,bones,raw,clips,motion,hands};
}
