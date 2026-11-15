#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { canonical,sha256,methodVersion,METHOD_ROOT,prepareRequirements,inputFingerprint,isTarget,writeJson,inside,normalizeLF,linesOf,safeRelative,externalDestination } from './lib/common.mjs';
import { createGit,preflight,rangeOf,treeOf,indexOf,untrackedOf,blobsOf,renamesOf,readWorktree,PreparationError } from './lib/git.mjs';
import { unifiedDiff,changedLineSets } from './lib/diff.mjs';
const SIZE_LIMIT=256*1024;
const sensitive=name=>/(^|\/)(\.env(?:\.|$)|\.sopify(?:\/|$)|\.codex(?:\/|$)|\.agents(?:\/|$)|\.aws(?:\/|$)|\.ssh(?:\/|$)|(?:credentials?|secrets?)(?:\.|\/|$)|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.|$))|\.(?:pem|key|p12|pfx|jks|keystore)$/i.test(name);
const excluded=name=>sensitive(name)||/(^|\/)(?:node_modules|vendor)(\/|$)/.test(name);
export function readState(git,target) {
  preflight(git); // Must precede every ls-files, including the consistency reread.
  const range=rangeOf(git,target),base=treeOf(git,range.baseSha),head=treeOf(git,range.headSha),index=indexOf(git),untracked=untrackedOf(git),renames=renamesOf(git,range);
  const gitlinks=new Set([...base,...head].filter(([,entry])=>entry.mode==='160000').map(([name])=>name));
  for(const [name,entries] of index)if(entries.some(entry=>entry.mode==='160000'))gitlinks.add(name);
  const names=[...new Set([...base.keys(),...head.keys(),...index.keys(),...untracked])].filter(name=>![...gitlinks].some(parent=>name.startsWith(parent+'/'))).sort();
  const states=new Map();
  for(const name of names){const hint=index.get(name)?.[0]?.mode||head.get(name)?.mode||base.get(name)?.mode;const state=readWorktree(git.root,name,git,hint,SIZE_LIMIT);
    if(hint==='160000'&&state.exists){state.gitOid=index.get(name)?.[0]?.oid||head.get(name)?.oid||null;state.sha256=state.gitOid?sha256('gitlink:'+state.gitOid):null;}
    states.set(name,state);
  }
  range.dirty=names.some(name=>{const state=states.get(name),entry=head.get(name);return entry ? !state.exists||entry.mode!==state.mode||entry.oid!==state.gitOid : state.exists;});
  const consumed=new Set(),candidates=[];
  for(const [name,oldPath] of renames){if(states.get(name)?.exists&&!states.get(oldPath)?.exists&&base.has(oldPath)){consumed.add(oldPath);consumed.add(name);candidates.push({name,oldPath,base:base.get(oldPath),state:states.get(name),change:'renamed'});}}
  for(const name of names){if(consumed.has(name))continue;const entry=base.get(name),state=states.get(name);
    if(!entry&&!state.exists)continue;
    if(entry&&state.exists&&entry.oid===state.gitOid&&entry.mode===state.mode)continue;
    const change=!entry?'added':!state.exists?'deleted':entry.oid===state.gitOid?'mode-changed':'modified';
    candidates.push({name,base:entry||null,state,change});
  }
  const objects=blobsOf(git,candidates.filter(c=>c.base?.type==='blob').map(c=>c.base.oid));
  const files=[],contents=new Map();
  for(const candidate of candidates){const {name,oldPath,state,change}=candidate,entry=candidate.base;
    const oldBytes=entry?.type==='blob'?objects.get(entry.oid):entry?.mode==='160000'?Buffer.from('gitlink:'+entry.oid):null;
    const newBytes=state.bytes??null;
    let kind=state.kind||'text';
    if(entry?.mode==='160000'||state.mode==='160000')kind='submodule';
    else if(entry?.mode==='120000'||state.mode==='120000')kind='symlink';
    else if(oldBytes?.includes(0)||state.kind==='binary')kind='binary';
    else if((oldBytes?.length||0)>SIZE_LIMIT||state.kind==='oversize')kind='oversize';
    if(excluded(name)||oldPath&&excluded(oldPath))kind='excluded';
    // Invalid UTF-8 is metadata-only, not replacement-character source code.
    if(['text','symlink'].includes(kind))try{for(const bytes of [oldBytes,newBytes])if(bytes)new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{kind='binary';}
    const file={path:name,...(oldPath?{oldPath}:{}),change,kind,baseMode:entry?.mode??null,headMode:state.exists?state.mode:null,
      baseSha256:oldBytes?sha256(oldBytes):null,headSha256:state.exists?state.sha256:null};
    if(kind==='submodule'){file.baseGitlink=entry?.oid??null;file.headGitlink=state.gitOid;file.note='Superproject gitlink metadata only; submodule worktree is not traversed';}
    else if(kind==='excluded')file.note='Sensitive path or dependency directory; content omitted';
    else if(kind==='oversize')file.note='Content exceeds 256 KiB; content omitted';
    else if(kind==='binary')file.note='Binary or invalid UTF-8; content omitted';
    else if(kind==='symlink')file.note='Link-target bytes only; symbolic link never followed';
    const oldText=oldBytes?.toString('utf8')||'',newText=newBytes?.toString('utf8')||'';
    if(['text','symlink'].includes(kind)){
      const patch=unifiedDiff(name,oldText,newText),changed=changedLineSets(patch);
      file.baseLineCount=entry?linesOf(oldText).length:0;file.headLineCount=state.exists?linesOf(newText).length:0;
      file.additions=changed.newLines.size;file.deletions=changed.oldLines.size;
      if(isTarget(file))contents.set(name,{base:oldBytes,head:newBytes,patch});
    }
    files.push(file);
  }
  files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  const fingerprint=canonical({range:{head:range.headSha,target:range.targetSha,base:range.baseSha},names,index:[...index],states:[...states].map(([name,s])=>[name,s.exists,s.mode??null,s.sha256??null,s.gitOid??null])});
  delete range.emptyTree;
  return {range,files,contents,fingerprint};
}
function externalOutput(git,value) {
  const output=path.resolve(value),parent=fs.realpathSync(path.dirname(output)),resolved=path.join(parent,path.basename(output));
  if(inside(git.root,resolved)||inside(git.gitDir,resolved)||inside(git.commonDir,resolved))throw new PreparationError('output-in-repository','Output must be outside the input repository and Git metadata');
  externalDestination(resolved);
  try { if(fs.lstatSync(resolved).isSymbolicLink())throw new PreparationError('output-symlink','Output leaf must not be a symbolic link'); } catch(error) { if(error.code!=='ENOENT')throw error; }
  return resolved;
}
export function prepare({repo,out,target,requirements=[],extension='',methodRoot=METHOD_ROOT,_testAfterRead}={}) {
  let git;const attempts=[];
  try{
    if(!repo||!out)throw new PreparationError('arguments','repo and out are required');
    git=createGit(repo);
    const output=externalOutput(git,out),resolvedParent=path.dirname(output);
    if(fs.existsSync(output))throw new PreparationError('output-exists','Refusing to overwrite an existing bundle');
    const sources=prepareRequirements(requirements),method=methodVersion(methodRoot),rulesFile=JSON.parse(fs.readFileSync(path.join(methodRoot,'rules/builtin.json'),'utf8'));
    const rules=rulesFile.rules.map(rule=>({kind:'builtin',...rule}));
    const ext=normalizeLF(extension),hasExtension=Boolean(ext.trim());
    if(hasExtension)rules.push({kind:'project',id:'extension',sha256:sha256(ext)});
    let captured;
    for(let attempt=0;attempt<3;attempt++){
      const first=readState(git,target);
      _testAfterRead?.({attempt,root:git.root});
      const second=readState(git,target);
      if(first.fingerprint===second.fingerprint){captured=first;attempts.push({attempt,stable:true});break;}
      attempts.push({attempt,stable:false});
    }
    if(!captured)throw new PreparationError('changed-during-read','Repository did not stabilize after two retries');
    const commits=blobsOf(git,[captured.range.headSha,captured.range.baseSha]);
    const subject=id=>Array.from((commits.get(id)?.toString('utf8').split(/\n\n/).slice(1).join('\n\n').split('\n')[0]||'').replace(/[\u0000-\u001f\u007f]/g,'')).slice(0,200).join('');
    captured.range.headSubject=subject(captured.range.headSha);captured.range.baseSubject=subject(captured.range.baseSha);
    const rulesVersion=sha256(canonical(rules));
    const snapshot={snapshotId:'',status:'complete',createdAt:new Date().toISOString(),range:captured.range,files:captured.files,requirements:sources,
      rulesVersion,promptVersion:method.promptVersion,...(hasExtension?{extensionPrompt:{text:ext,sha256:sha256(ext),length:Array.from(ext).length}}:{}),note:'Diffs compare raw frozen bytes; no Git filters, textconv or external diff are run'};
    snapshot.inputSha=inputFingerprint(snapshot);snapshot.snapshotId='snap-'+snapshot.inputSha.slice(0,24);
    const targets=captured.files.filter(isTarget).map(file=>file.path);
    const stage=fs.mkdtempSync(path.join(resolvedParent,'.'+path.basename(output)+'.staging-'));
    try{
      writeJson(path.join(stage,'snapshot.json'),snapshot);writeJson(path.join(stage,'requirements.json'),sources);writeJson(path.join(stage,'targets.json'),targets);writeJson(path.join(stage,'rules.json'),rules);
      for(const file of captured.files.filter(isTarget)){
        const content=captured.contents.get(file.path);
        for(const side of ['base','head']){const bytes=content[side];if(bytes===null)continue;const name=side==='base'?(file.oldPath||file.path):file.path;const dest=path.join(stage,side,safeRelative(name));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);}
        const diff=path.join(stage,'diff',file.path+'.patch');fs.mkdirSync(path.dirname(diff),{recursive:true});fs.writeFileSync(diff,content.patch);
      }
      if(hasExtension)fs.writeFileSync(path.join(stage,'extension.md'),ext);
      fs.renameSync(stage,output);
    }catch(error){fs.rmSync(stage,{recursive:true,force:true});throw error;}
    return {status:'complete',bundle:output,inputSha:snapshot.inputSha,promptVersion:snapshot.promptVersion,rulesVersion,targetCount:targets.length,attempts,methodFiles:method.files,commands:git.log};
  }catch(error){return {status:'incomplete',code:error.code||'preparation-failed',reason:error.message,attempts,commands:git?.log||[]};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const options={};for(let i=2;i<process.argv.length;i++){const key=process.argv[i];if(!['--repo','--out','--target','--requirements','--extension','--report'].includes(key)||!process.argv[i+1]){console.error('Usage: node core/prepare.mjs --repo PATH --out EXTERNAL_BUNDLE [--target REF] [--requirements SOURCES.json] [--extension FILE] [--report REPORT.json]');process.exit(2);}options[key.slice(2)]=process.argv[++i];}
  let result;
  try {
    const reportFile=options.report?externalOutput(createGit(options.repo),options.report):null;
    result=prepare({repo:options.repo,out:options.out,target:options.target,requirements:options.requirements?JSON.parse(fs.readFileSync(options.requirements,'utf8')):[],extension:options.extension?fs.readFileSync(options.extension,'utf8'):''});
    if(reportFile)writeJson(reportFile,result);
  } catch(error) { result={status:'incomplete',code:error.code||'invalid-input',reason:error.message}; }
  console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='complete'?0:2;
}
