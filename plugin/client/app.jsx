import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { DeliveryList, WorkspacePicker } from './list.jsx';
import { Review } from './review.jsx';
import { Settings } from './settings.jsx';
import { Icon, IconButton } from './ui.jsx';
export { DeliveryList, Review, Settings };
export function Panel({ runtime }) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot), [settings, setSettings] = useState(null), data = state.data;
  useEffect(() => { runtime.refresh(); }, [runtime]);
  const openSettings = event => { if (data?.settings) setSettings({ workspaceId: state.workspaceId, settings: data.settings, anchor: event.currentTarget, sharedRepo: data.workspaces.filter(w => w.projectKey === data.project.projectKey).length > 1 }); };
  return <main className="el-plugin" data-testid="evidentloop-panel">
    {state.page === 'list' && <header className="el-page-header"><h1>变更评审</h1>{data && <WorkspacePicker runtime={runtime} state={state}/>}<span className="el-header-spacer"/><label className="el-search"><Icon name="search" size={14}/><input type="search" aria-label="搜索交付、分支或需求编号" placeholder="搜索交付、分支或需求编号" disabled={!data} value={state.query || ''} onChange={e => runtime.update({ query: e.target.value })}/></label><IconButton label="工作区设置" icon="settings" onClick={openSettings} disabled={!data?.project?.projectKey}/></header>}
    {state.error && <div role="alert" className="el-error">{state.error}<button className="el-btn" onClick={() => runtime.refresh()}>重新加载</button><button className="el-btn" onClick={() => runtime.update({ error: '' })}>关闭</button></div>}
    {state.notice && <div role="status" className="el-notice">{state.notice}<button className="el-btn" onClick={() => runtime.update({ notice: '' })}>关闭</button></div>}
    {data?.modelTestGate && !data.modelTestGate.approved && <p className="el-test-gate">演示模式：未开启真实模型调用。当前可查看代码与已有审查记录。</p>}
    {state.loading ? <p role="status">正在读取工作区…</p> : !data ? <section className="el-empty">插件尚未连接，无法读取交付。</section> : state.page === 'preparing' ? <section className="el-empty" role="status">正在冻结审查输入，不调用模型…</section> : state.page === 'review' && state.record ? <Review runtime={runtime} state={state} openSettings={openSettings}/> : <DeliveryList runtime={runtime} state={state}/>}
    {settings && <Settings runtime={runtime} workspaceId={settings.workspaceId} settings={settings.settings} anchor={settings.anchor} sharedRepo={settings.sharedRepo} close={() => setSettings(null)}/>}
  </main>;
}
