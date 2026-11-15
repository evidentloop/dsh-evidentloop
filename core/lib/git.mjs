// Read-only plumbing adapted from prototype/scripts/build-data.mjs, without its synthetic layer.
// Index v4 handling follows gitformat-index (NUL suffix, no v2/v3 padding).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { safeRelative, sha256 } from './common.mjs';
export const ALLOWED_GIT = new Set(['rev-parse','merge-base','ls-tree','ls-files','cat-file','diff-tree']);
export class PreparationError extends Error { constructor(code,message) { super(message); this.code=code; } }
export function gitEnvironment() {
  const env={...process.env};
  for(const key of Object.keys(env)) if (['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_OBJECT_DIRECTORY','GIT_ALTERNATE_OBJECT_DIRECTORIES','GIT_COMMON_DIR','GIT_NAMESPACE'].includes(key)||key.startsWith('GIT_TRACE')||key.startsWith('GIT_CONFIG'))delete env[key];
  return {...env,GIT_OPTIONAL_LOCKS:'0',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0'};
}
export function createGit(input) {
  const log=[];
  const invoke=(cwd,location,args,{input:stdin}={})=>{
    if(!ALLOWED_GIT.has(args[0]))throw new PreparationError('git-command-forbidden',args[0]);
    log.push({command:args[0],args:args.slice(1),optionalLocks:0,lazyFetch:0,fsmonitor:false});
    try{return execFileSync('git',[...location,'-c','core.fsmonitor=false',...args],{cwd,env:gitEnvironment(),input:stdin,maxBuffer:256*1024*1024,stdio:['pipe','pipe','pipe']});}
    catch(error){throw new PreparationError('git-read-failed','Read-only git '+args[0]+' failed: '+String(error.stderr||error.message).slice(0,500));}
  };
  const inputPath=fs.realpathSync(input);
  const root=fs.realpathSync(invoke(inputPath,[],['rev-parse','--show-toplevel']).toString().trim());
  const gitDir=invoke(root,[],['rev-parse','--absolute-git-dir']).toString().trim();
  const commonRaw=invoke(root,[],['rev-parse','--git-common-dir']).toString().trim();
  const commonDir=path.resolve(root,commonRaw);
  const run=(args,options)=>invoke(root,[`--git-dir=${gitDir}`,`--work-tree=${root}`],args,options);
  const objectFormat=run(['rev-parse','--show-object-format']).toString().trim();
  if(!['sha1','sha256'].includes(objectFormat))throw new PreparationError('object-format-unsupported','Cannot identify Git object format');
  const resolve=ref=>{try { const result=run(['rev-parse','--verify','--quiet',ref+'^{commit}']).toString().trim();return new RegExp('^[0-9a-f]{'+(objectFormat==='sha1'?40:64)+'}$').test(result)?result:null; }catch{return null;}};
  return {root,gitDir,commonDir,objectFormat,oidBytes:objectFormat==='sha1'?20:32,run,resolve,log};
}
export function inspectIndex(buffer,oidBytes=20) {
  const fail=message=>{throw new PreparationError('index-unconfirmed',message);};
  if(buffer.length<12+oidBytes||buffer.toString('ascii',0,4)!=='DIRC')fail('Unrecognized or truncated index');
  const version=buffer.readUInt32BE(4),count=buffer.readUInt32BE(8),end=buffer.length-oidBytes;
  if(![2,3,4].includes(version))fail('Unsupported index version');
  if(!crypto.timingSafeEqual(crypto.createHash(oidBytes===20?'sha1':'sha256').update(buffer.subarray(0,end)).digest(),buffer.subarray(end)))fail('Index checksum mismatch');
  let offset=12;
  for(let i=0;i<count;i++){
    const start=offset,flagsAt=offset+40+oidBytes;
    if(flagsAt+2>end)fail('Truncated index entry');
    const flags=buffer.readUInt16BE(flagsAt);offset=flagsAt+2;
    if(flags&0x4000){if(version<3||offset+2>end)fail('Invalid extended index flags');const extra=buffer.readUInt16BE(offset);offset+=2;if(extra&0x4000)throw new PreparationError('sparse-checkout','Sparse index/worktree is not frozen by this trial');}
    if(version===4){let byte;let length=0;do{if(offset>=end||++length>10)fail('Invalid v4 prefix length');byte=buffer[offset++];}while(byte&0x80);}
    while(offset<end&&buffer[offset]!==0)offset++;
    if(offset>=end)fail('Unterminated index path');offset++;
    if(version!==4)offset=start+Math.ceil((offset-start)/8)*8;
    if(offset>end)fail('Invalid index padding');
  }
  let split=false;
  while(offset<end){if(offset+8>end)fail('Truncated index extension');const name=buffer.toString('ascii',offset,offset+4),size=buffer.readUInt32BE(offset+4);if(name==='link')split=true;else if(name==='sdir')throw new PreparationError('sparse-checkout','Sparse index is not frozen');else if(name[0]===name[0].toLowerCase())fail('Unknown required index extension');offset+=8+size;if(offset>end)fail('Invalid index extension size');}
  return {version,count,split};
}
export const EMPTY_WORKTREE_MESSAGE = '当前仓库还没有文件。';
export function currentBranchOf(git) {
  if (!git.resolve('HEAD')) {
    const file = path.join(git.gitDir, 'HEAD'), stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new PreparationError('branch-unconfirmed', '无法确认当前分支');
    const match = fs.readFileSync(file, 'utf8').trim().match(/^ref: refs\/heads\/(.+)$/);
    return match ? safeRelative(match[1]) : '';
  }
  return git.run(['rev-parse', '--verify', '--quiet', '--abbrev-ref', 'HEAD']).toString().trim();
}
export function preflight(git) {
  for(const directory of new Set([git.gitDir,git.commonDir])) {
    if(fs.readdirSync(directory).some(name=>name.startsWith('sharedindex.')))throw new PreparationError('split-index','sharedindex.* present; no ls-files or freeze performed');
    for(const name of ['config','config.worktree']){
      const file=path.join(directory,name);if(!fs.existsSync(file))continue;
      let section='';
      for(const raw of fs.readFileSync(file,'utf8').split(/\r?\n/)){
        const text=raw.trim();if(/^\[/.test(text)){section=text.slice(1,text.indexOf(']')).toLowerCase();continue;}
        if(section.startsWith('include')&&/^path\s*=/i.test(text))throw new PreparationError('config-include-unconfirmed','Included repository config is not expanded by the minimal split-index preflight');
        if(section==='core'&&/^splitindex(?:\s*=\s*(?:"?(?:true|yes|on|1)"?)(?:\s*[#;].*)?)?$/i.test(text))throw new PreparationError('split-index','core.splitIndex enabled; no freeze performed');
        if(section==='core'&&/^sparsecheckout\s*=\s*(true|yes|on|1)/i.test(text))throw new PreparationError('sparse-checkout','Sparse checkout requires a later collector');
      }
    }
  }
  const index=path.join(git.gitDir,'index');
  if(!fs.existsSync(index)&&!git.resolve('HEAD')&&currentBranchOf(git))return;
  if(!fs.existsSync(index)||!fs.lstatSync(index).isFile()||fs.lstatSync(index).isSymbolicLink())throw new PreparationError('index-unconfirmed','Index absent or not a regular file; no ls-files performed');
  if(fs.existsSync(index)&&inspectIndex(fs.readFileSync(index),git.oidBytes).split)throw new PreparationError('split-index','Index link extension found before ls-files');
}
export function rangeOf(git,target) {
  const headSha=git.resolve('HEAD'),emptyTree=crypto.createHash(git.objectFormat).update('tree 0\0').digest('hex');
  if(!headSha) {
    let rawHead = ''; try { rawHead = git.run(['rev-parse','--verify','--quiet','HEAD']).toString().trim(); } catch {}
    const branch = currentBranchOf(git);
    if(rawHead || !branch) throw new PreparationError('head-unavailable','无法读取当前提交，请检查仓库引用是否完整');
    return {kind:'empty-tree-worktree',targetRef:target||branch,targetSha:null,baseSha:emptyTree,headSha:null,dirty:false,emptyTree};
  }
  if(git.run(['rev-parse','--is-shallow-repository']).toString().trim()==='true')throw new PreparationError('shallow-history','Repository history is shallow');
  let targetRef=target,targetSha=target&&git.resolve(target);
  if(target&&!targetSha)throw new PreparationError('target-missing','Explicit target does not resolve to a commit');
  if(!target){for(const ref of ['origin/HEAD','main','master']){const sha=git.resolve(ref);if(sha){targetRef=ref;targetSha=sha;break;}}}
  if(!targetSha)throw new PreparationError('target-missing','No target branch found; provide --target');
  let bases=[];try{bases=git.run(['merge-base','--all',headSha,targetSha]).toString().trim().split('\n').filter(Boolean);}catch{}
  if(bases.length!==1)throw new PreparationError(bases.length?'multiple-merge-bases':'no-merge-base','Expected exactly one merge base');
  return {kind:'merge-base-worktree',targetRef,targetSha,baseSha:bases[0],headSha,dirty:false,emptyTree};
}
export function branchLabelOf(git, ref) {
  let full=git.run(['rev-parse','--symbolic-full-name',ref]).toString().trim();const seen=new Set();
  while(full.endsWith('/HEAD')){
    if(seen.has(full))throw new PreparationError('target-branch-unconfirmed','Cyclic symbolic target');seen.add(full);safeRelative(full);
    const file=path.join(git.commonDir,full);
    if(!fs.existsSync(file)||!fs.lstatSync(file).isFile()||fs.lstatSync(file).isSymbolicLink())throw new PreparationError('target-branch-unconfirmed','Cannot confirm symbolic target branch');
    const match=fs.readFileSync(file,'utf8').trim().match(/^ref:\s+(refs\/(?:heads|remotes)\/[^\s]+)$/);
    if(!match)throw new PreparationError('target-branch-unconfirmed','Invalid symbolic target branch');full=match[1];
  }
  if(full.startsWith('refs/heads/'))return full.slice('refs/heads/'.length);
  if(full.startsWith('refs/remotes/')){
    const names=new Set(['origin']);for(const dir of new Set([git.gitDir,git.commonDir])){const config=path.join(dir,'config');if(fs.existsSync(config))for(const match of fs.readFileSync(config,'utf8').matchAll(/^\s*\[remote\s+"([^"\\]+)"\]/gm))names.add(match[1]);}
    const name=[...names].sort((a,b)=>b.length-a.length).find(n=>full.startsWith('refs/remotes/'+n+'/'));
    if(name)return full.slice(('refs/remotes/'+name+'/').length);
  }
  throw new PreparationError('target-branch-unconfirmed','Target must resolve to a named branch');
}
const nul=buffer=>buffer.toString('utf8').split('\0').filter(Boolean);
export function treeOf(git,sha) {
  return new Map(nul(git.run(['ls-tree','-r','-z',sha])).map(record=>{const tab=record.indexOf('\t'),[mode,type,oid]=record.slice(0,tab).split(' '),name=safeRelative(record.slice(tab+1));return [name,{mode,type,oid}];}));
}
export function indexOf(git) {
  const entries=new Map();
  for(const record of nul(git.run(['ls-files','-z','-s']))){const tab=record.indexOf('\t'),[mode,oid,stage]=record.slice(0,tab).split(' '),name=safeRelative(record.slice(tab+1));if(!entries.has(name))entries.set(name,[]);entries.get(name).push({mode,oid,stage:Number(stage)});}
  if([...entries.values()].some(list=>list.some(entry=>entry.stage!==0)))throw new PreparationError('unmerged-index','Unmerged paths exist');
  return entries;
}
export const untrackedOf=git=>nul(git.run(['ls-files','-z','-o','--exclude-standard'])).map(safeRelative);
export function blobsOf(git,oids) {
  const ids=[...new Set(oids.filter(Boolean))],map=new Map();if(!ids.length)return map;
  const bytes=git.run(['cat-file','--batch'],{input:ids.join('\n')+'\n'});let offset=0;
  for(const id of ids){const end=bytes.indexOf(10,offset);if(end<0)throw new PreparationError('object-missing','Truncated cat-file output');const header=bytes.toString('utf8',offset,end).split(' ');offset=end+1;
    if(header[1]==='missing'||header[1]!=='blob'&&header[1]!=='commit')throw new PreparationError('object-missing','Unavailable frozen Git object '+id);
    const size=Number(header[2]);if(!Number.isSafeInteger(size)||size<0||offset+size>=bytes.length)throw new PreparationError('object-missing','Truncated object bytes');const content=bytes.subarray(offset,offset+size);if(header[0]!==id||crypto.createHash(git.objectFormat).update(header[1]+' '+size+'\0').update(content).digest('hex')!==id)throw new PreparationError('object-corrupt','Git object identity mismatch');map.set(id,content);offset+=size+1;}
  return map;
}
export function renamesOf(git,range) {
  const map=new Map();if(!range.headSha||range.baseSha===range.headSha)return map;
  const records=nul(git.run(['diff-tree','--no-commit-id','-r','--name-status','-z','-M','--no-ext-diff','--no-textconv',range.baseSha,range.headSha]));
  for(let i=0;i<records.length;){const status=records[i++];if(status.startsWith('R')||status.startsWith('C')){const old=safeRelative(records[i++]),name=safeRelative(records[i++]);if(status.startsWith('R'))map.set(name,old);}else safeRelative(records[i++]);}
  return map;
}
export function readWorktree(root,name,git,modeHint,sizeLimit) {
  const parts=safeRelative(name).split('/'),full=path.join(root,...parts);
  const parentsSafe=()=>{let here=root;for(const part of parts.slice(0,-1)){here=path.join(here,part);let stat;try{stat=fs.lstatSync(here);}catch(error){if(error.code==='ENOENT'||error.code==='ENOTDIR')return false;throw error;}if(stat.isSymbolicLink()||!stat.isDirectory())return false;}return true;};
  if(!parentsSafe())return {exists:false};
  let stat;try{stat=fs.lstatSync(full);}catch(error){if(['ENOENT','ENOTDIR'].includes(error.code))return {exists:false};throw error;}
  if(modeHint==='160000'&&stat.isDirectory())return {exists:true,mode:'160000',kind:'submodule',gitOid:null,sha256:null};
  if(stat.isSymbolicLink()){const bytes=Buffer.from(fs.readlinkSync(full));return {exists:true,mode:'120000',kind:'symlink',sha256:sha256(bytes),gitOid:crypto.createHash(git.objectFormat).update('blob '+bytes.length+'\0').update(bytes).digest('hex'),bytes};}
  if(!stat.isFile())return {exists:false};
  if(fs.constants.O_NOFOLLOW===undefined)throw new PreparationError('platform-unsupported','O_NOFOLLOW required for working-tree reads');
  const fd=fs.openSync(full,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try{
    const actual=fs.fstatSync(fd),again=fs.lstatSync(full);if(!parentsSafe()||actual.ino!==stat.ino||actual.dev!==stat.dev||actual.ino!==again.ino||actual.dev!==again.dev)throw new PreparationError('changed-during-read','File identity changed during open');
    const hash=crypto.createHash('sha256'),oid=crypto.createHash(git.objectFormat).update('blob '+actual.size+'\0'),parts=[],chunk=Buffer.alloc(65536);let length=0,binary=false,n;
    while((n=fs.readSync(fd,chunk,0,chunk.length,null))>0){const data=chunk.subarray(0,n);hash.update(data);oid.update(data);binary ||= data.includes(0);length+=n;if(length<=sizeLimit)parts.push(Buffer.from(data));}
    const final=fs.fstatSync(fd);if(length!==actual.size||final.size!==actual.size)throw new PreparationError('changed-during-read','File length changed during read');
    return {exists:true,mode:(actual.mode&0o111)?'100755':'100644',kind:binary?'binary':length>sizeLimit?'oversize':'text',sha256:hash.digest('hex'),gitOid:oid.digest('hex'),bytes:!binary&&length<=sizeLimit?Buffer.concat(parts):null};
  }finally{fs.closeSync(fd);}
}
