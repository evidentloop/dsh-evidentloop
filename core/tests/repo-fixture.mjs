// Fixtures are private temporary repositories constructed with fs/zlib, not Git write commands.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
export function repository(root,{format='sha1'}={}) {
  fs.mkdirSync(path.join(root,'.git/objects'),{recursive:true});fs.mkdirSync(path.join(root,'.git/refs/heads'),{recursive:true});
  fs.writeFileSync(path.join(root,'.git/HEAD'),'ref: refs/heads/feature\n');
  fs.writeFileSync(path.join(root,'.git/config'),'[core]\n repositoryformatversion = '+(format==='sha1'?'0':'1')+'\n bare = false\n'+(format==='sha256'?'[extensions]\n objectformat = sha256\n':''));
  const index=Buffer.alloc(12);index.write('DIRC');index.writeUInt32BE(2,4);fs.writeFileSync(path.join(root,'.git/index'),Buffer.concat([index,crypto.createHash(format).update(index).digest()]));
  const object=(type,value)=>{const content=Buffer.isBuffer(value)?value:Buffer.from(value),raw=Buffer.concat([Buffer.from(type+' '+content.length+'\0'),content]),oid=crypto.createHash(format).update(raw).digest('hex'),file=path.join(root,'.git/objects',oid.slice(0,2),oid.slice(2));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,zlib.deflateSync(raw));return oid;};
  const tree=files=>{
    const nested={};for(const [name,spec] of Object.entries(files)){const pieces=name.split('/');let node=nested;for(const part of pieces.slice(0,-1))node=node[part]??={};node[pieces.at(-1)]={leaf:true,...(typeof spec==='string'?{text:spec}:spec)};}
    const build=node=>{const rows=[];for(const name of Object.keys(node).sort()){const entry=node[name];if(entry.leaf){const mode=entry.mode||'100644',oid=entry.oid||object('blob',entry.bytes??entry.text??'');rows.push({name,mode,oid});}else rows.push({name,mode:'40000',oid:build(entry)});}rows.sort((a,b)=>Buffer.compare(Buffer.from(a.name+(a.mode==='40000'?'/':'')),Buffer.from(b.name+(b.mode==='40000'?'/':''))));return object('tree',Buffer.concat(rows.flatMap(row=>[Buffer.from(row.mode+' '+row.name+'\0'),Buffer.from(row.oid,'hex')])));};return build(nested);
  };
  const commit=(files,parents=[],subject='fixture')=>object('commit','tree '+tree(files)+'\n'+parents.map(id=>'parent '+id+'\n').join('')+'author Fixture <fixture@example.com> 1700000000 +0000\ncommitter Fixture <fixture@example.com> 1700000000 +0000\n\n'+subject+'\n');
  const ref=(name,oid)=>fs.writeFileSync(path.join(root,'.git/refs/heads',name),oid+'\n');
  const worktree=files=>{for(const [name,spec] of Object.entries(files)){const full=path.join(root,name),entry=typeof spec==='string'?{text:spec}:spec;fs.mkdirSync(path.dirname(full),{recursive:true});if(entry.mode==='120000')fs.symlinkSync(entry.text,full);else if(entry.mode==='160000')fs.mkdirSync(full,{recursive:true});else{fs.writeFileSync(full,entry.bytes??entry.text??'');fs.chmodSync(full,entry.mode==='100755'?0o755:0o644);}}};
  return {root,object,tree,commit,ref,worktree,format};
}
