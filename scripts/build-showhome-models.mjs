import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdir, writeFile } from 'node:fs/promises';

// Reproducible, real-scale meshes based on the developer's three interior references.
// Hidden surfaces and details are artist interpretations, not recovered source geometry.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
};
const material = (name, color, options = {}) => { const m = new T.MeshPhysicalMaterial({ color, roughness: .8, ...options }); m.name = name; return m; };
const linen = material('linen', '#d6cfc3', { sheen: .65, sheenRoughness: .8, sheenColor: '#e9e1d6' });
const white = material('white-linen', '#efebe4', { sheen: .6, sheenRoughness: .85, sheenColor: '#fff5e4' });
const dark = material('charcoal-linen', '#4a4138', { sheen: .5, sheenColor: '#a29585' });
const rust = material('rust-linen', '#a25735', { sheen: .6, sheenColor: '#d49868' });
const wood = material('walnut', '#674630', { roughness: .48, clearcoat: .1 });
const stitch = material('stitch', '#b9ae9d');
const ceramic = material('porcelain', '#f6f5f0', { roughness: .13, clearcoat: .4 });
const metal = material('brass', '#a68a55', { roughness: .25, metalness: .9 });
const scene = new T.Group();
const models = [];
const add = (g, geo, mat, at, rotation) => { const m = new T.Mesh(geo, mat); if (at) m.position.set(...at); if (rotation) m.rotation.set(...rotation); g.add(m); return m; };
function rounded(g, at, size, mat, radius=.035, soft=false, rotation) {
  const geo = new RoundedBoxGeometry(...size, soft ? 4 : 3, Math.min(radius, ...size.map(x=>x*.45)));
  if (soft) {
    const p = geo.attributes.position;
    for (let i=0;i<p.count;i++) {
      const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
      const edge = Math.pow(Math.max(Math.abs(x)/(size[0]/2), Math.abs(z)/(size[2]/2)), 5);
      const fold = Math.sin(x*38+Math.sin(z*11))*Math.sin(z*31+x*9) * .0035 * edge;
      p.setY(i,y + Math.sign(y || 1)*fold);
    }
    geo.computeVertexNormals();
  }
  return add(g, geo, mat, at, rotation);
}
function seam(g, width, depth, y, z=0, x=0, mat=stitch) {
  const r=.045, points=[];
  for(let k=0;k<4;k++) for(let j=0;j<=12;j++) {
    const a=k*Math.PI/2+j/12*Math.PI/2;
    const cx=(k===0||k===3?1:-1)*(width/2-r), cz=(k<2?1:-1)*(depth/2-r);
    points.push(new T.Vector3(x+cx+Math.cos(a)*r,y,z+cz+Math.sin(a)*r));
  }
  const curve=new T.CatmullRomCurve3(points,true);
  add(g,new T.TubeGeometry(curve,96,.0018,4,true),mat);
}
function cloth(g, width, length, centreZ, top, mat, drop=.22, rustle=1) {
  const nx=64,nz=48, positions=[],uv=[],indices=[];
  for(let j=0;j<=nz;j++) for(let i=0;i<=nx;i++) {
    const u=i/nx,v=j/nz,x=(u-.5)*width,z=(v-.5)*length+centreZ;
    const side=Math.max(0,Math.abs(x)-(width/2-drop));
    const foot=Math.max(0,z-(centreZ+length/2-drop));
    let y=top - Math.max(side,foot)*1.8;
    y+=rustle*(Math.sin(x*21+z*3)*.009+Math.sin(z*17-x*5)*.008+Math.sin(x*52+z*9)*.0025);
    y+=Math.exp(-Math.pow((z-centreZ+length*.28)/.08,2))*.026;
    positions.push(x,y,z); uv.push(u*2,v*2);
    if(i<nx&&j<nz){const a=j*(nx+1)+i; indices.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
  const m=mat.clone();m.side=T.DoubleSide;add(g,geo,m);
}
function pillow(g, at, w, d, mat, tilt=0) {
  const part=new T.Group();part.position.set(...at);part.rotation.x=tilt;g.add(part);
  rounded(part,[0,0,0],[w,.15,d],mat,.07,true);
  seam(part,w-.04,d-.04,0);
}
function make(name, build) { const g=new T.Group();g.name=name;build(g);models.push(g); }

make('Sofa',g=>{
  rounded(g,[0,.21,0],[2.16,.28,.86],linen,.09,true);
  for(const x of [-.99,.99]) rounded(g,[x,.48,0],[.22,.68,.89],linen,.09,true);
  for(const x of [-.48,.48]) {
    rounded(g,[x,.43,.045],[.93,.17,.68],linen,.07,true);
    rounded(g,[x,.69,-.32],[.94,.52,.19],linen,.07,true,[-.09,0,0]);
    seam(g,.87,.6,.43,.045,x);
  }
  for(const x of [-.87,.87]) for(const z of [-.31,.31]) rounded(g,[x,.045,z],[.075,.09,.075],wood,.01);
  pillow(g,[-.48,.59,-.15],.46,.42,dark,-1.1);
  pillow(g,[.45,.58,-.14],.43,.4,white,-1.1);
  cloth(g,.55,.83,.16,.54,dark,.13,.7);
});
make('ClubChair',g=>{
  const points=[],indices=[],uv=[]; const na=80,ny=12;
  for(let j=0;j<=ny;j++)for(let i=0;i<=na;i++){
    const a=-2.05+i/na*4.1, v=j/ny;
    const radius=.38+.035*Math.sin(v*Math.PI);
    points.push(Math.sin(a)*radius,.12+v*.67,-Math.cos(a)*radius);uv.push(i/na*3,v*2);
    if(i<na&&j<ny){const k=j*(na+1)+i;indices.push(k,k+1,k+na+1,k+1,k+na+2,k+na+1);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
  const mat=linen.clone();mat.side=T.DoubleSide;add(g,geo,mat);
  rounded(g,[0,.21,0],[.76,.3,.73],linen,.14,true);
  rounded(g,[0,.43,.01],[.61,.15,.58],linen,.07,true);
  rounded(g,[0,.65,-.27],[.59,.36,.14],linen,.06,true,[-.12,0,0]);
  pillow(g,[0,.55,-.08],.29,.28,rust,-.85);
  seam(g,.57,.53,.43,.01);
});
make('Bed',g=>{
  rounded(g,[0,.16,0],[1.99,.30,2.14],linen,.055);
  rounded(g,[0,.40,0],[1.94,.24,2.08],white,.08,true);
  seam(g,1.88,2.02,.45);
  cloth(g,2.36,2.34,.12,.565,white,.25);
  cloth(g,2.38,.65,.36,.606,rust,.25,.7);
  for(const x of [-.47,.47]){
    pillow(g,[x,.66,-.73],.82,.49,white,-.15);
    pillow(g,[x,.73,-.56],.58,.4,dark,-.45);
    pillow(g,[x,.76,-.39],.33,.26,rust,-.55);
  }
});
make('Curtain',g=>{
  const nx=60,ny=36, p=[],uv=[],idx=[];
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const u=i/nx,v=j/ny;
    const x=(u-.5)*.65;
    const z=Math.sin(u*Math.PI*12)*.044*(.75+v*.25)+Math.sin(v*7+u*13)*.007;
    p.push(x,2.65*(1-v)+Math.cos(u*Math.PI*12)*.008*v,z);uv.push(u*1.8,v*4);
    if(i<nx&&j<ny){const k=j*(nx+1)+i;idx.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
  const mat=material('curtain-linen','#92785b',{roughness:.92,sheen:.5,side:T.DoubleSide});add(g,geo,mat);
});
make('Basin',g=>{
  const points=[[0,-.02],[.13,-.02],[.19,.01],[.21,.065],[.2,.09],[.18,.085],[.16,.02],[.04,.005]].map(([x,y])=>new T.Vector2(x,y));
  const mesh=add(g,new T.LatheGeometry(points,80),ceramic,[0,0,0]);mesh.scale.z=.72;
  add(g,new T.CylinderGeometry(.022,.022,.002,32),metal,[0,.007,0]);
});
make('WC',g=>{
  const bowl=new T.LatheGeometry([[0,-.13],[.09,-.13],[.145,-.07],[.18,.06],[.17,.11],[.14,.115],[.12,.03],[.05,-.04]].map(([x,y])=>new T.Vector2(x,y)),64);
  const mesh=add(g,bowl,ceramic,[0,0,0]);mesh.scale.z=1.35;
  const seat=add(g,new T.TorusGeometry(.157,.018,10,80),ceramic,[0,.115,0],[-Math.PI/2,0,0]);seat.scale.y=1.35;
  rounded(g,[0,.04,-.19],[.29,.14,.11],ceramic,.025);
});

make('FeatherPendant',g=>{
  const shape=new T.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(.085,.09,0,.24);shape.quadraticCurveTo(-.085,.09,0,0);
  const petal=new T.ShapeGeometry(shape,10);
  const mat=material('pendant-petal','#f1eee5',{roughness:.82,side:T.DoubleSide});
  const count=90;
  for(let i=0;i<count;i++){
    const y=1-2*(i+.5)/count, r=Math.sqrt(1-y*y), angle=i*2.399963;
    const n=new T.Vector3(Math.cos(angle)*r,y,Math.sin(angle)*r);
    const m=add(g,petal.clone(),mat,n.clone().multiplyScalar(.18).toArray());
    m.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),n);
    m.rotateZ(angle*.7);
  }
  add(g,new T.SphereGeometry(.13,20,16),white);
});

// Merge static meshes per material to keep draw calls bounded in the interactive viewer.
for(const model of models){
  model.updateMatrixWorld(true); const groups=new Map();
  model.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);const key=o.material.uuid;const list=groups.get(key)??{material:o.material,geometries:[]};list.geometries.push(geo.index?geo.toNonIndexed():geo);groups.set(key,list);});
  const out=new T.Group();out.name=model.name;
  for(const {material,geometries} of groups.values())add(out,mergeGeometries(geometries,false),material);
  scene.add(out);
}
await mkdir('public/showhome',{recursive:true});
const binary=await new GLTFExporter().parseAsync(scene,{binary:true});
await writeFile('public/showhome/northpark-furnishings.glb',Buffer.from(binary));
console.log(`Built ${models.length} reference furniture meshes: ${(binary.byteLength/1048576).toFixed(2)} MB`);
