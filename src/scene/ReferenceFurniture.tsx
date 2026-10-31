import { Component, Suspense, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { MeshReflectorMaterial, useGLTF, useTexture } from '@react-three/drei';
import type { Flat } from '../data/types';
import type { Piece } from '../lib/furniture';
import { flatXform } from '../lib/interiorFrame';
import { referenceFurniture, type ReferencePart } from '../lib/referenceFurniture';
import { useStore } from '../store/useStore';
import { Pieces, PIECE_MATS } from './Pieces';
import { marbleTexture, surfaceTexture } from './textures';

const base=`${import.meta.env.BASE_URL}showhome/`;
const PBR_MAPS = ['fabric_pattern_07_nor_gl_1k.jpg','fabric_pattern_07_rough_1k.jpg','marble_01_diff_1k.jpg','marble_01_nor_gl_1k.jpg','marble_01_rough_1k.jpg'].map(f=>`${base}materials/${f}`);

// An unavailable optional art asset must never prevent a visitor from entering a flat.
class AssetBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?this.props.fallback:this.props.children;}
}

function Instance({ source, part, shadows }: { source: THREE.Object3D; part: ReferencePart; shadows: boolean }) {
  const instance=useMemo(()=>{
    const clone=source.clone(true);
    clone.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(clone), size=box.getSize(new THREE.Vector3());
    const centre=box.getCenter(new THREE.Vector3());
    clone.position.set(-centre.x,-box.min.y,-centre.z);
    clone.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=shadows;o.receiveShadow=true;o.raycast=()=>null;
      const material=o.material as THREE.MeshPhysicalMaterial;
      if(part.color&&material.name==='linen'){const m=material.clone();m.color.set(part.color);o.material=m;}
    }});
    return {clone,size};
  },[source,shadows,part.color]);
  return <group position={[part.x,part.y,part.z]} rotation-y={part.rotation}>
    <group scale={[part.width/instance.size.x,part.height/instance.size.y,part.depth/instance.size.z]}><primitive object={instance.clone} /></group>
  </group>;
}

function LoadedFurniture({ flat, pieces, shadows }: { flat: Flat; pieces: Piece[]; shadows: boolean }) {
  const furniture=useGLTF(`${base}northpark-furnishings.glb`);
  const plant=useGLTF(`${base}potted_plant_01/model.gltf`);
  const [normal,rough,marble,marbleNormal,marbleRough]=useTexture(PBR_MAPS);
  const design=useStore(s=>s.design[flat.id]);
  const currentRoom=useStore(s=>s.currentRoom);
  const assembly=useMemo(()=>referenceFurniture(pieces,flatXform(flat).layout,new Set(Object.entries(design?.edits??{}).filter(([,e])=>e.replace||e.rot).map(([tag])=>tag))),[flat,pieces,design]);
  const materials=useMemo(()=>{
    const material=(PIECE_MATS.marble as THREE.MeshStandardMaterial).clone();
    // Keep the reference's white/grey/gold palette; the scanned stone supplies microdetail.
    material.map=marbleTexture();material.normalMap=marbleNormal;material.normalScale.set(.10,.10);material.roughnessMap=marbleRough;material.roughness=.38;
    return {marble:material};
  },[marble,marbleNormal,marbleRough]);
  const sources=useMemo(()=>{
    for(const texture of [normal,rough,marble,marbleNormal,marbleRough]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;}
    marble.colorSpace=THREE.SRGBColorSpace;
    const scene=furniture.scene.clone(true);
    scene.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;
      const m=(o.material as THREE.MeshPhysicalMaterial).clone();
      if(m.name.includes('linen')) {
        m.map=surfaceTexture('linen'); m.normalMap=normal; m.normalScale.set(.08,.08);m.roughnessMap=rough;
      }
      if(m.name==='walnut'){m.map=surfaceTexture('oak');m.roughness=.5;}
      o.material=m;
    });
    const greenery=plant.scene.clone(true);
    greenery.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;
      const m=(o.material as THREE.MeshStandardMaterial).clone();
      if(m.name.toLowerCase().endsWith('_pot')){m.map=null;m.color.set('#d6cebf');m.roughness=.75;}
      if(m.alphaMap||m.transparent){m.alphaTest=.4;m.depthWrite=true;m.transparent=false;m.side=THREE.DoubleSide;}
      o.material=m;
    });
    const result=new Map<string,THREE.Object3D>([['Plant',greenery]]);
    for(const name of ['Sofa','ClubChair','Bed','Curtain','Basin','WC','FeatherPendant']) {
      const source=scene.getObjectByName(name);
      if(source)result.set(name,source);
    }
    return result;
  },[furniture.scene,plant.scene,normal,rough,marble,marbleNormal,marbleRough]);
  return <><Pieces pieces={assembly.pieces} shadows={shadows} materials={materials} />{assembly.parts.map((part,i)=>{
    if(part.model==='WallRing')return <mesh key={`ring-${i}`} position={[part.x,part.y,part.z]} rotation-y={part.rotation}>
      <torusGeometry args={[part.width/2,.008,8,96]} /><meshStandardMaterial color="#b3afa4" roughness={.24} metalness={.9} />
    </mesh>;
    if(part.model==='Mirror') return <mesh key={`mirror-${i}`} position={[part.x+Math.sin(part.rotation)*.012,part.y,part.z+Math.cos(part.rotation)*.012]} rotation-y={part.rotation}>
      <circleGeometry args={[part.width/2,64]} />
      {currentRoom===part.room?<MeshReflectorMaterial resolution={256} mirror={1} mixStrength={1} blur={[0,0]} color="#f4f4f2" metalness={.7} roughness={.06} />:<meshStandardMaterial color="#d3d3cb" metalness={1} roughness={.09} />}
    </mesh>;
    const source=sources.get(part.model);
    return source?<Instance key={`${part.model}-${i}`} source={source} part={part} shadows={shadows} />:null;
  })}</>;
}

export function ReferenceFurniture(props: { flat: Flat; pieces: Piece[]; shadows: boolean }) {
  const fallback=<Pieces pieces={props.pieces} shadows={props.shadows} />;
  return <AssetBoundary fallback={fallback}><Suspense fallback={fallback}><LoadedFurniture {...props} /></Suspense></AssetBoundary>;
}
