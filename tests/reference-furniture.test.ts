import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { referenceFurniture } from '../src/lib/referenceFurniture.ts';

const layout={rooms:[{name:'Living',kind:'living',x:0,y:0,w:5,h:5}],segs:[]};
const sofa={x:2,y:.3,z:.5,sx:2.2,sy:.6,sz:.9,color:'#d3cdc3',shape:'cushion',mat:'fabric',solid:true,tag:'Living::sofa'};

test('a detailed sofa replaces its visual pieces without mutating navigation data',()=>{
  const input=[{...sofa}];
  const original=JSON.stringify(input);
  const result=referenceFurniture(input as never,layout as never);
  assert.equal(result.parts[0].model,'Sofa');
  assert.equal(result.pieces.length,0);
  assert.equal(JSON.stringify(input),original);
  assert.equal(result.parts[0].width,2.2);
  assert.ok(Math.abs(result.parts[0].depth-.9)<1e-10);
  assert.ok(result.parts.every(p=>[p.x,p.y,p.z,p.width,p.height,p.depth,p.rotation].every(Number.isFinite)));
});

test('catalogue replacements and added furniture keep their chosen appearance',()=>{
  assert.equal(referenceFurniture([sofa] as never,layout as never,new Set(['Living::sofa'])).parts.length,0);
  const added={...sofa,tag:'Living::sofa#custom'};
  assert.equal(referenceFurniture([added] as never,layout as never).pieces.length,1);
});

test('mixed lounge décor is not stretched into one giant replacement sofa',()=>{
  const lounge={rooms:[{...layout.rooms[0],name:'Family Lounge',kind:'lounge'}],segs:[]};
  const furniture=[{...sofa,tag:'Family Lounge::sofa'},{...sofa,x:4,y:1.5,tag:'Family Lounge::sofa'}];
  const result=referenceFurniture(furniture as never,lounge as never);
  assert.equal(result.parts.length,0);
  assert.equal(result.pieces.length,2);
});

test('every glTF texture/buffer is locally available and detailed GLB models are present',()=>{
  const plant=resolve('public/showhome/potted_plant_01/model.gltf');
  const data=JSON.parse(readFileSync(plant,'utf8'));
  for(const item of [...data.buffers,...data.images]) {
    assert.ok(!/^https?:/.test(item.uri),'Runtime model dependency must be local');
    assert.ok(existsSync(resolve(dirname(plant),item.uri)),`Missing ${item.uri}`);
  }
  const binary=readFileSync('public/showhome/northpark-furnishings.glb');
  assert.equal(binary.toString('utf8',0,4),'glTF');
  assert.equal(binary.readUInt32LE(4),2);
  assert.equal(binary.readUInt32LE(8),binary.byteLength);
  assert.ok(binary.byteLength<7*1024*1024,'Furniture asset exceeds the web budget');
  const json=JSON.parse(binary.toString('utf8',20,20+binary.readUInt32LE(12)));
  const names=new Set(json.nodes.map((n:{name:string})=>n.name));
  for(const name of ['Sofa','ClubChair','Bed','Curtain','Basin','WC','FeatherPendant'])assert.ok(names.has(name),`Missing ${name}`);
});
