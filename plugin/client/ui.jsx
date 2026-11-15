import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
export function Icon({ name, size = 16, strokeWidth = 1.65 }) {
  const shapes = {
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
    brand: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M9 8.5l-2 2.5 2 2.5m4-5 2 2.5-2 2.5"/></>,
    settings: <><path d="m9 3-1 3-3 1-2 4 2 2-1 4 4 2 3-1 3 3 4-2v-4l3-2-1-4-3-1-1-4z"/><circle cx="12" cy="12" r="3"/></>,
    more: <><circle cx="5" cy="12" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="19" cy="12" r=".8"/></>,
    chevronLeft: <path d="m15 6-6 6 6 6"/>, chevronRight: <path d="m9 6 6 6-6 6"/>,
    down: <path d="m6 9 6 6 6-6"/>, up: <path d="m6 15 6-6 6 6"/>,
    pin: <path d="M4 4h16M12 21V8m-6 6 6-6 6 6"/>, next: <path d="M12 3v18m-7-7 7 7 7-7"/>,
    grid: <path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z"/>,
    list: <path d="M4 6h16M4 12h16M4 18h16"/>, tree: <path d="M5 3v13h14M5 8h14M12 5v6m0 2v6"/>,
    split: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/></>,
    comment: <path d="M4 4h16v12H9l-5 4z"/>, ask: <><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z"/></>,
    minus: <><circle cx="12" cy="12" r="9"/><path d="M7 12h10"/></>, copy: <><path d="M8 8h13v13H8zM16 8V3H3v13h5"/></>,
    download: <path d="M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3"/>, back: <path d="m14 4-8 8 8 8"/>, close: <path d="m5 5 14 14M19 5 5 19"/>,
    folder: <path d="M3 6h7l2 3h9v12H3z"/>, check: <path d="m4 12 5 5L20 6"/>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name] || shapes.more}</svg>;
}
export function IconButton({ label, icon, children, size, className = '', ...props }) { return <button type="button" className={['el-icon-button', size && 'el-icon-button--' + size, className].filter(Boolean).join(' ')} title={label} aria-label={label} {...props}>{icon && <Icon name={icon} size={size === 'sm' || size === 'tree' ? 14 : size === 'toolbar' ? 18 : 16} strokeWidth={size === 'toolbar' ? 1.8 : 1.65}/>}{children}</button>; }
export function Clip({ children, className = '' }) {
  const ref = useRef(), [clipped, setClipped] = useState(false), text = typeof children === 'string' ? children : undefined;
  useEffect(() => { const e = ref.current, update = () => setClipped(e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1); update(); const o = new ResizeObserver(update); o.observe(e); return () => o.disconnect(); }, [children]);
  return <span ref={ref} className={'el-clip ' + className} title={clipped ? text : undefined}>{children}</span>;
}
export function Link({ children, onClick, ...props }) { return <button type="button" className="el-link" onClick={e => { e.stopPropagation(); onClick?.(e); }} {...props}>{children}<span aria-hidden="true" className="el-link-arrow">→</span></button>; }
export function Menu({ label, icon = 'more', children, items, disabled, search, size }) {
  const [open, setOpen] = useState(false), trigger = useRef(), menu = useRef(), [position, setPosition] = useState({ left: 0, top: 0 }), id = useId();
  const close = (focus = true) => { setOpen(false); if (focus) queueMicrotask(() => trigger.current?.focus()); };
  useEffect(() => {
    if (!open) return; const r = trigger.current.getBoundingClientRect(); setPosition({ left: Math.max(8, Math.min(r.left, innerWidth - 252)), top: Math.min(r.bottom + 4, Math.max(8, innerHeight - Math.min(items.length * 38 + 16, 340))) });
    queueMicrotask(() => menu.current?.querySelector('input,[role^=menuitem]:not(:disabled)')?.focus());
    const outside = e => { if (!menu.current?.contains(e.target) && !trigger.current?.contains(e.target)) close(false); }; document.addEventListener('pointerdown', outside); return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const keyboard = e => {
    if (e.isComposing) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') {
      e.preventDefault(); close(false);
      queueMicrotask(() => { const buttons = [...document.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(el => el.getClientRects().length && !el.closest('.el-menu-layer,[aria-hidden="true"]')); const i = buttons.indexOf(trigger.current); (buttons[i + (e.shiftKey ? -1 : 1)] || trigger.current)?.focus(); });
    }
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const buttons = [...menu.current.querySelectorAll('[role^=menuitem]:not(:disabled)')], i = buttons.indexOf(document.activeElement); buttons[e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : i < 0 ? e.key === 'ArrowUp' ? buttons.length - 1 : 0 : (i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus(); }
  };
  return <><button ref={trigger} type="button" aria-label={label} title={open ? undefined : label} aria-expanded={open} aria-controls={id} aria-haspopup="menu" disabled={disabled} className={children ? 'el-menu-trigger' : 'el-icon-button' + (size ? ' el-icon-button--' + size : '')} onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); } }} onClick={e => { e.stopPropagation(); setOpen(!open); }}>{children || <Icon name={icon} size={size === 'toolbar' ? 18 : 16} strokeWidth={size === 'toolbar' ? 1.8 : 1.65}/>}{children && <Icon name={open ? 'up' : 'down'}/>}</button>{open && createPortal(<div className="el-plugin el-menu-layer" style={position}><div ref={menu} role="menu" id={id} aria-label={label} onKeyDown={keyboard}>{search && <input aria-label={search.label} placeholder={search.label} value={search.value} onChange={e => search.onChange(e.target.value)} onKeyDown={e => { if (!['ArrowDown', 'ArrowUp', 'Escape'].includes(e.key)) e.stopPropagation(); }}/>}{items.map((item, i) => item.separator ? <hr key={i}/> : <button key={i} type="button" role={item.checkbox ? 'menuitemcheckbox' : 'menuitem'} aria-checked={item.checkbox ? Boolean(item.selected) : undefined} aria-current={!item.checkbox && item.selected ? 'true' : undefined} disabled={item.disabled} className={item.danger ? 'el-danger' : ''} onClick={e => { e.stopPropagation(); if (!item.keepOpen) close(); item.action?.(); }}><span>{item.label}</span>{item.selected && <Icon name="check"/>}{item.note && <small>{item.note}</small>}</button>)}</div></div>, document.body)}</>;
}
export function Dialog({ title, children, close, className = '', anchor }) {
  const ref = useRef(), id = useId(), before = useRef(document.activeElement);
  const rect = anchor?.getBoundingClientRect(), position = rect ? { position: 'fixed', width: 280, left: Math.max(8, Math.min(rect.right - 280, innerWidth - 288)), top: Math.max(8, Math.min(rect.bottom + 6, innerHeight - 180)) } : undefined;
  useEffect(() => { queueMicrotask(() => (ref.current?.querySelector('[data-autofocus]') || ref.current?.querySelector('textarea,input,select') || ref.current?.querySelector('button') || ref.current)?.focus()); return () => { if (before.current?.isConnected) before.current.focus(); }; }, []);
  const key = e => { if (e.isComposing || e.nativeEvent?.isComposing) return; if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } if (e.key === 'Tab') { const list = [...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')].filter(x => x.getClientRects().length); if (!list.length) { e.preventDefault(); return; } if (e.shiftKey && document.activeElement === list[0]) { e.preventDefault(); list.at(-1).focus(); } else if (!e.shiftKey && document.activeElement === list.at(-1)) { e.preventDefault(); list[0].focus(); } } };
  return createPortal(<div className={'el-plugin el-dialog-mask' + (anchor ? ' el-anchored-mask' : '')} onPointerDown={e => { if (e.target === e.currentTarget) close(); }}><section ref={ref} role={anchor ? 'alertdialog' : 'dialog'} tabIndex={-1} aria-modal="true" aria-labelledby={id} style={position} className={'el-dialog ' + className} onKeyDown={key}><header><h2 id={id}>{title}</h2><IconButton label="关闭" icon="close" size="sm" onClick={close}/></header>{children}</section></div>, document.body);
}
export function Confirm({ title, children, action, close, confirm = '确认', danger = false, anchor }) { return <Dialog title={title} close={close} anchor={anchor}><p>{children}</p><footer><button className="el-btn" data-autofocus onClick={close}>取消</button><button className={danger ? 'el-btn el-danger' : 'el-btn'} onClick={action}>{confirm}</button></footer></Dialog>; }
// Plain React nodes only: no raw HTML, external image loading or script execution.
// The same renderer is used for model prose, suggestions and extension previews.
export function Prose({ text = '' }) {
  const blocks = String(text).replace(/\r\n?/g, '\n').split(/(```[^\n]*\n[\s\S]*?(?:```|$))/g).filter(Boolean);
  const inline = value => value.split(/(`[^`\n]+`)/g).map((s, i) => s.startsWith('`') && s.endsWith('`') ? <code key={i}>{s.slice(1, -1)}</code> : s);
  return <div className="el-prose">{blocks.map((block, i) => block.startsWith('```') ? <pre key={i}><code>{block.slice(block.indexOf('\n') + 1).replace(/```$/, '')}</code></pre> : block.split(/\n\s*\n/).filter(Boolean).map((p, j) => <p key={i + ':' + j}>{inline(p)}</p>))}</div>;
}
export function localTime(value) { return value ? new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '时间不可用'; }
export function relativeTime(value) { const n = Date.parse(value); if (!Number.isFinite(n)) return ''; const m = Math.max(0, Math.floor((Date.now() - n) / 60000)); return m < 1 ? '刚刚' : m < 60 ? m + '分钟前' : m < 1440 ? Math.floor(m / 60) + '小时前' : Math.floor(m / 1440) + '天前'; }
export const basename = p => p?.split('/').at(-1) || p;
