#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { canonical,sha256,normalizeLF,linesOf,prepareRequirements,inputFingerprint,isTarget,safeRelative,METHOD_ROOT,writeJson,inside,physicalDestination,externalDestination } from './lib/common.mjs';
import { structuralErrors } from './lib/schema.mjs';
import { unifiedDiff,changedLineSets } from './lib/diff.mjs';
function readFrozen(root,name) {
  const parts=safeRelative(name).split('/');let file=root;
  for(const part of parts){file=path.join(file,part);const stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw Error('Bundle contains a symbolic link: '+name);}
  if(!fs.statSync(file).isFile())throw Error('Bundle entry is not a file: '+name);
  return fs.readFileSync(file);
}
export function loadBundle(directory) {
  const root=fs.realpathSync(directory),read=name=>JSON.parse(readFrozen(root,name).toString('utf8'));
  const snapshot=read('snapshot.json'),requirements=read('requirements.json'),targets=read('targets.json'),rules=read('rules.json');
  if(!['complete','incomplete'].includes(snapshot.status)||!snapshot.range||!Array.isArray(snapshot.files)||!Array.isArray(requirements)||!Array.isArray(targets)||!Array.isArray(rules))throw Error('Malformed bundle metadata');
  if(canonical(requirements)!==canonical(snapshot.requirements)||canonical(prepareRequirements(requirements))!==canonical(requirements))throw Error('Frozen requirement source/item identity mismatch');
  const names=new Set();
  for(const file of snapshot.files){
    safeRelative(file.path);if(file.oldPath)safeRelative(file.oldPath);
    if(!['added','modified','deleted','renamed','mode-changed'].includes(file.change)||!['text','binary','oversize','excluded','submodule','symlink','conflicted'].includes(file.kind))throw Error('Invalid snapshot file identity');
    if(file.change==='renamed'&&!file.oldPath)throw Error('Renamed file needs oldPath');
    for(const side of ['base','head']){
      const mode=file[side+'Mode'],hash=file[side+'Sha256'];
      if(!(mode===null||['100644','100755','120000','160000'].includes(mode))||!(hash===null||typeof hash==='string'&&/^[0-9a-f]{64}$/.test(hash))||(mode===null)!==(hash===null))throw Error('Invalid snapshot side identity');
    }
    if(names.has(file.path))throw Error('Duplicate snapshot path');names.add(file.path);
  }
  const expectedTargets=snapshot.files.filter(isTarget).map(f=>f.path).sort();
  if(canonical([...targets].sort())!==canonical(expectedTargets)||new Set(targets).size!==targets.length)throw Error('targets do not match snapshot-derived review scope');
  if(snapshot.inputSha!==inputFingerprint(snapshot)||snapshot.rulesVersion!==sha256(canonical(rules))||!/^[0-9a-f]{64}$/.test(snapshot.promptVersion))throw Error('Bundle fingerprints do not match');
  const ruleKeys=new Set();for(const rule of rules){if(!['builtin','project','user'].includes(rule.kind)||typeof rule.id!=='string'||!rule.id||ruleKeys.has(rule.kind+':'+rule.id))throw Error('Invalid/duplicate bundle rule');ruleKeys.add(rule.kind+':'+rule.id);}
  const expected=new Set(['snapshot.json','requirements.json','targets.json','rules.json']);
  const extension=rules.filter(rule=>rule.kind==='project'&&rule.id==='extension');
  if(snapshot.extensionPrompt){
    if(extension.length!==1)throw Error('Extension rule missing');const bytes=readFrozen(root,'extension.md');expected.add('extension.md');
    const text=bytes.toString('utf8');if(text!==normalizeLF(text)||snapshot.extensionPrompt.text!==text||sha256(bytes)!==snapshot.extensionPrompt.sha256||extension[0].sha256!==sha256(bytes)||snapshot.extensionPrompt.length!==Array.from(text).length)throw Error('Extension bytes/rule/snapshot disagree');
  }else if(extension.length)throw Error('Unexpected extension rule');
  const texts=new Map(),files=new Map(),changed=new Map();
  for(const file of snapshot.files.filter(isTarget)){
    files.set(file.path,file);
    for(const side of ['base','head']){
      const hash=file[side+'Sha256'];if(hash===null)continue;if(!/^[0-9a-f]{64}$/.test(hash))throw Error('Invalid side hash');
      const name=side==='base'?(file.oldPath||file.path):file.path,relative=side+'/'+name;expected.add(relative);
      const bytes=readFrozen(root,relative);if(sha256(bytes)!==hash)throw Error('Frozen side sha256 mismatch: '+relative);
      const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);texts.set(side+':'+name,{file,side,text,lines:linesOf(text),sha256:hash});
    }
    const old=texts.get('base:'+(file.oldPath||file.path))?.text||'',head=texts.get('head:'+file.path)?.text||'';
    const relative='diff/'+file.path+'.patch';expected.add(relative);const patch=readFrozen(root,relative).toString('utf8');
    if(patch!==unifiedDiff(file.path,old,head))throw Error('Frozen diff does not match frozen sides');changed.set(file.path,changedLineSets(patch));
  }
  const walk=(directory,prefix='')=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const relative=prefix+entry.name;if(entry.isSymbolicLink())throw Error('Symbolic link in bundle');if(entry.isDirectory())walk(path.join(directory,entry.name),relative+'/');else if(!expected.has(relative))throw Error('Unexpected bundle file: '+relative);}};walk(root);
  return {root,snapshot,requirements,targets,rules,ruleKeys,texts,files,changed};
}
export function validate(bundleDirectory,model,{runId=crypto.randomUUID(),schemaPath=path.join(METHOD_ROOT,'schema/run.schema.json'),schemaBytes}={}) {
  const failed=(layer,errors)=>({status:'failed',layer,errors,withheld:[],downgrades:[],complete:false,formal:null});
  let bundle;try{bundle=loadBundle(bundleDirectory);}catch(error){return failed('bundle-integrity',[error.message]);}
  let errors;try{errors=structuralErrors(model,JSON.parse(schemaBytes ?? fs.readFileSync(schemaPath,'utf8')));}catch(error){return failed(1,[error.message]);}
  if(errors.length)return failed(1,errors);
  const {snapshot,requirements,targets,ruleKeys}=bundle;
  const invariant=[];const sameSet=(a,b)=>a.length===b.length&&new Set(a).size===a.length&&a.every(x=>b.includes(x));
  if(model.inputSha!==snapshot.inputSha)invariant.push('inputSha mismatch');
  if(model.promptVersion!==snapshot.promptVersion)invariant.push('promptVersion mismatch');
  if(!sameSet(model.files.map(f=>f.path),targets))invariant.push('files must cover every target exactly once');
  const items=requirements.flatMap(source=>source.items.map(item=>({...item,source,text:Array.from(source.text).slice(item.start,item.end).join('')}))),byItem=new Map(items.map(item=>[item.itemId,item]));
  if(!sameSet(model.alignment.map(row=>row.requirementItemId),items.map(item=>item.itemId)))invariant.push('alignment must cover each frozen requirement item exactly once');
  if(model.overview.requirementStatus!==(requirements.length?'checked':'no-requirement'))invariant.push('requirementStatus mismatch');
  if(!requirements.length&&(model.alignment.length||model.extras.length))invariant.push('alignment/extras must be empty without requirements');
  const featureById=new Map(model.features.map(f=>[f.featureId,f]));
  if(featureById.size!==model.features.length)invariant.push('duplicate featureId');
  for(const feature of model.features){
    if(new Set(feature.files).size!==feature.files.length||feature.files.some(file=>!targets.includes(file)))invariant.push('feature files outside targets or duplicated');
    for(const file of feature.files)if(!model.files.find(entry=>entry.path===file)?.featureIds.includes(feature.featureId))invariant.push('feature/file reverse membership mismatch');
  }
  for(const file of model.files){if(new Set(file.featureIds).size!==file.featureIds.length)invariant.push('duplicate file featureIds');for(const id of file.featureIds)if(!featureById.get(id)?.files.includes(file.path))invariant.push('dangling/inconsistent featureId');}
  for(const finding of model.findings)if(!ruleKeys.has(finding.ruleSource.kind+':'+finding.ruleSource.id))invariant.push('unknown ruleSource kind/id');
  if(invariant.length)return failed(2,invariant);
  const withheld=[],downgrades=[];
  const hold=(kind,ref,code,reason)=>withheld.push({kind,ref,code,reason,layer:kind==='finding'?4:3});
  const lookup=ref=>{
    safeRelative(ref.path);const side=bundle.texts.get(ref.side+':'+ref.path);
    if(!side||!Number.isSafeInteger(ref.startLine)||!Number.isSafeInteger(ref.endLine)||ref.startLine<1||ref.endLine<ref.startLine||ref.endLine>side.lines.length)throw Error('Path, side or frozen line range is invalid');
    return {...side,normalized:{path:side.file.path,side:ref.side,startLine:ref.startLine,endLine:ref.endLine}};
  };
  const statement=(entry,ref)=>{
    if(!entry.refs.length){hold('statement',ref,'missing-ref','Statement needs a valid frozen reference');return null;}
    try{return {...entry,refs:entry.refs.map(item=>lookup(item).normalized),basis:'model'};}catch(error){hold('statement',ref,'invalid-ref',error.message);return null;}
  };
  const features=model.features.map((f,i)=>statement(structuredClone(f),'feature:'+f.featureId)).filter(Boolean);
  const retained=new Set(features.map(f=>f.featureId));
  const files=model.files.map(file=>{
    const items=file.semantic.items.map((entry,i)=>statement(entry,'file:'+file.path+':'+i)).filter(Boolean);
    let status=file.semantic.status;
    if(status==='stated'&&!items.length){status='unclear';downgrades.push({ref:'file:'+file.path,code:'stated-without-items'});if(!file.semantic.items.length)hold('statement','file:'+file.path,'missing-ref','stated needs at least one supported item');}
    return {path:file.path,featureIds:file.featureIds.filter(id=>retained.has(id)),semantic:{status,items},basis:'model'};
  });
  const impacts=model.impacts.map((entry,i)=>statement(entry,'impact:'+i)).filter(Boolean);
  const extras=model.extras.map((entry,i)=>statement(entry,'extra:'+i)).filter(Boolean);
  const alignment=model.alignment.map(entry=>{
    const row=structuredClone(entry);row.basis='model';
    if(row.status==='superseded'){
      const old=byItem.get(row.requirementItemId),target=byItem.get(row.supersededBy);let reason='';
      if(!target||target.itemId===old.itemId)reason='Target requirement is missing or self';
      else if(!(target.source.order>old.source.order||target.source.order===old.source.order&&target.start>old.start))reason='Target requirement is not strictly later';
      else if(!normalizeLF(row.supersededQuote).trim()||!target.text.includes(normalizeLF(row.supersededQuote)))reason='Quote is not verbatim within the target requirement item';
      if(!reason)row.supersededQuote=normalizeLF(row.supersededQuote);
      if(reason){row.status='unclear';delete row.supersededBy;delete row.supersededQuote;row.note='调整依据未通过校验，需确认：'+reason;downgrades.push({ref:'alignment:'+row.requirementItemId,code:'invalid-superseded',reason});hold('statement','alignment:'+row.requirementItemId,'invalid-ref',reason);}
    }else{
      const valid=[];for(const ref of row.codeRefs)try{valid.push(lookup(ref).normalized);}catch(error){hold('statement','alignment:'+row.requirementItemId,'invalid-ref',error.message);}
      row.codeRefs=valid;
      if(['implemented','partial'].includes(row.status)&&snapshot.status!=='complete'){row.status='unclear';row.note='审查覆盖不足，需确认：'+row.note;downgrades.push({ref:'alignment:'+row.requirementItemId,code:'incomplete-coverage'});}
      if(['implemented','partial'].includes(row.status)&&!valid.length){row.status='unclear';row.note='实现依据未通过校验，需确认：'+row.note;downgrades.push({ref:'alignment:'+row.requirementItemId,code:'missing-code-refs'});if(!entry.codeRefs.length)hold('statement','alignment:'+row.requirementItemId,'missing-ref','Implemented/partial needs valid code refs');}
    }
    return row;
  });
  const featureIds=Object.fromEntries(features.map(feature=>[feature.featureId,'feature-'+sha256(canonical([runId,feature.featureId])).slice(0,24)]));
  const findings=[];
  model.findings.forEach((entry,index)=>{
    try{
      const anchor=bundle.texts.get(entry.anchor.side+':'+safeRelative(entry.anchor.path));
      if(!anchor)throw Error('Anchor path/side is absent');
      if(entry.anchor.line!==null&&(entry.anchor.line<1||entry.anchor.line>anchor.lines.length))throw Error('Anchor line is outside frozen text');
      const evidence=entry.evidence.map(ref=>{
        const side=lookup(ref),quote=side.lines.slice(ref.startLine-1,ref.endLine).join('\n');
        if(normalizeLF(ref.quote)!==quote)throw Error('Evidence quote mismatch');
        return {...side.normalized,sha256:side.sha256,quote};
      });
      const primary=evidence[0];
      if(primary.path!==anchor.file.path||primary.side!==entry.anchor.side)throw Error('Primary evidence must match anchor file and side');
      if(entry.anchor.line!==null&&(entry.anchor.line<primary.startLine||entry.anchor.line>primary.endLine))throw Error('Primary evidence does not cover anchor');
      const changed=bundle.changed.get(anchor.file.path)[entry.anchor.side==='base'?'oldLines':'newLines'];
      if(![...changed].some(line=>line>=primary.startLine&&line<=primary.endLine))throw Error('Primary evidence does not intersect changed lines');
      findings.push({...structuredClone(entry),findingId:'finding-'+sha256(canonical([runId,index])).slice(0,24),runId,anchor:{...entry.anchor,path:anchor.file.path},evidence,basis:'verified'});
    }catch(error){hold('finding','finding:'+index,'invalid-evidence',error.message);}
  });
  const rank={P0:0,P1:1,P2:2};findings.sort((a,b)=>rank[a.severity]-rank[b.severity]||targets.indexOf(a.anchor.path)-targets.indexOf(b.anchor.path)||(a.anchor.line??Number.MAX_SAFE_INTEGER)-(b.anchor.line??Number.MAX_SAFE_INTEGER));
  const understanding={overview:{...model.overview,basis:'model'},features:features.map(feature=>({...feature,featureId:featureIds[feature.featureId]})),files:files.map(file=>({...file,featureIds:file.featureIds.map(id=>featureIds[id])})),impacts,alignment,extras};
  const coverage={reviewed:[...targets],skipped:snapshot.files.filter(file=>!isTarget(file)).map(file=>({path:file.path,reason:file.note||'metadata-only'})),failed:[],withheld:withheld.map(({kind,ref,code})=>({kind,ref,code}))};
  const complete=snapshot.status==='complete'&&coverage.failed.length===0&&withheld.length===0&&sameSet(coverage.reviewed,targets);
  return {status:'succeeded',layer:4,errors:[],withheld,downgrades,complete,mapping:{featureIds},formal:{run:{runId,status:'succeeded',inputSha:snapshot.inputSha,promptVersion:snapshot.promptVersion,coverage,complete},understanding,findings}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const args={};for(let i=2;i<process.argv.length;i++){if(!['--bundle','--model','--out'].includes(process.argv[i])||!process.argv[i+1]){console.error('Usage: node core/validate.mjs --bundle DIR --model JSON [--out REPORT.json]');process.exit(2);}args[process.argv[i].slice(2)]=process.argv[++i];}
  try {
    const destination=args.out?externalDestination(args.out):null;
    if(destination && inside(fs.realpathSync(args.bundle),destination))throw Error('Validation report must not overwrite the frozen bundle');
    const raw=fs.readFileSync(args.model,'utf8');let result;
    try { result=validate(args.bundle,JSON.parse(raw)); }
    catch(error) { result={status:'failed',layer:1,errors:['Invalid model JSON: '+error.message],withheld:[],downgrades:[],complete:false,formal:null}; }
    if(destination)writeJson(destination,result);
    console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='failed'?1:0;
  }catch(error){console.error(error.message);process.exitCode=2;}
}
