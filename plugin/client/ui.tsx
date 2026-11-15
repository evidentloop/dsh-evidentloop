interface MenuItem {
  label?: string;
  separator?: boolean;
  checkbox?: boolean;
  selected?: boolean;
  disabled?: boolean;
  danger?: boolean;
  keepOpen?: boolean;
  note?: string;
  icon?: string;
  action?: () => unknown;
}
interface DialogProps extends React.PropsWithChildren {
  title: string;
  close(): void;
  className?: string;
  anchor?: HTMLElement;
}
import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
export function Icon({
  name,
  size = 16,
  strokeWidth = 1.8,
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
}) {
  // Geometry follows prototype P.icons, including its filled 16-unit glyphs.
  const shapes: Record<string, React.ReactNode> = {
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    brand: (
      <>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
        <path d="m9 8.5-2 2.5 2 2.5M13 8.5l2 2.5-2 2.5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="2.8" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.08a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.08a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.08a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.08a1.7 1.7 0 0 0-1.52 1z" />
      </>
    ),
    more: (
      <>
        <circle cx="5.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="18.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      </>
    ),
    chevronLeft: (
      <>
        <path fillRule="evenodd" clipRule="evenodd" d="M10.78 2.22a.75.75 0 00-1.06 0L4.468 7.472a.75.75 0 000 1.06l5.252 5.252a.75.75 0 101.06-1.06L6.06 8.001l4.72-4.721a.75.75 0 000-1.06z" />
      </>
    ),
    chevronRight: (
      <>
        <path fillRule="evenodd" clipRule="evenodd" d="M5.22 2.22a.75.75 0 011.06 0l5.252 5.252a.75.75 0 010 1.06L6.28 13.784a.75.75 0 11-1.06-1.06l4.72-4.723L5.22 3.28a.75.75 0 010-1.06z" />
      </>
    ),
    down: (
      <>
        <polyline points="6 9 12 15 18 9" />
      </>
    ),
    up: (
      <>
        <g transform="rotate(180 12 12)"><polyline points="6 9 12 15 18 9" />
        </g>
      </>
    ),
    collapsed: (
      <>
        <g transform="rotate(-90 12 12)"><polyline points="6 9 12 15 18 9" />
        </g>
      </>
    ),
    pin: (
      <>
        <path d="M5 4h14M12 20V8M7 13l5-5 5 5" />
      </>
    ),
    next: (
      <>
        <path d="M12 4v16M6 14l6 6 6-6" />
      </>
    ),
    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </>
    ),
    list: (
      <>
        <path d="M8 5h12M8 12h12M8 19h12M4 5h.01M4 12h.01M4 19h.01" />
      </>
    ),
    tree: (
      <>
        <path fillRule="evenodd" clipRule="evenodd" d="M2.5 1.75a.75.75 0 00-1.5 0v8.5a3 3 0 003 3h3V14a1 1 0 001 1h6a1 1 0 001-1v-3a1 1 0 00-1-1H8a1 1 0 00-1 1v.75H4a1.5 1.5 0 01-1.5-1.5V6.849c.441.255.954.401 1.5.401h3V8a1 1 0 001 1h6a1 1 0 001-1V5a1 1 0 00-1-1H8a1 1 0 00-1 1v.75H4a1.5 1.5 0 01-1.5-1.5v-2.5zm11 11.75h-5v-2h5v2zm-5-6v-2h5v2h-5z" />
      </>
    ),
    split: (
      <>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
        <path d="M12 4.5v15" />
      </>
    ),
    single: (
      <>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      </>
    ),
    comment: (
      <>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </>
    ),
    commentPlus: (
      <>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M12 8v6" />
        <path d="M9 11h6" />
      </>
    ),
    chat: (
      <>
        <path d="M4 5h16v11H9l-5 4z" />
      </>
    ),
    ask: (
      <>
        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
        <path d="M19 4v4" />
        <path d="M22 5h-4" />
      </>
    ),
    minus: (
      <>
        <circle cx="12" cy="12" r="9" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </>
    ),
    copy: (
      <>
        <path fill="currentColor" d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3V2a1 1 0 0 1 1-1h8ZM10 6H2v8h8V6ZM9 11v1H3v-1h6Zm5-9H6v3h4a1 1 0 0 1 1 1v4h3V2ZM9 8v1H3V8h6Z" />
      </>
    ),
    download: (
      <>
        <path d="M12 4v11" />
        <path d="m8 11 4 4 4-4" />
        <path d="M5 20h14" />
      </>
    ),
    back: (
      <>
        <path d="M15 5l-7 7 7 7" />
      </>
    ),
    close: (
      <>
        <path d="M6 6l12 12M18 6 6 18" />
      </>
    ),
    folder: (
      <>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m8 12 2.7 2.7L16 9.5" />
      </>
    ),
    arrowRight: <path d="M4 12h16M14 6l6 6-6 6" />,
    closeReport: <path d="M20 12H4M14 18l6-6-6-6" />,
    report: (
      <>
        <path d="M4 19h16M4 5h16" />
        <rect x="8" y="9" width="8" height="6" rx="1" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3.5 19 6v5.2c0 4.1-2.7 7.8-7 9.3-4.3-1.5-7-5.2-7-9.3V6z" />
        <path d="m9.2 12 2 2 3.6-3.8" />
      </>
    ),
    treeCheck: (
      <>
        <circle cx="8" cy="8" r="6.5"  />
        <path d="m4.5 8 2.3 2.3 4.7-4.6" />
      </>
    ),
  };
  const filled = ["tree", "chevronLeft", "chevronRight", "copy"].includes(name);
  const compactViewBox = filled || name === "treeCheck";
  return (
    <svg
      width={size}
      height={size}
      viewBox={compactViewBox ? "0 0 16 16" : "0 0 24 24"}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[name] || shapes.more}
    </svg>
  );
}
export function IconButton({
  label,
  icon,
  children,
  size,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon?: string;
  size?: "sm" | "tree" | "toolbar";
}) {
  return (
    <button
      type="button"
      className={[
        "el-icon-button",
        size && "el-icon-button--" + size,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={label}
      aria-label={label}
      {...props}
    >
      {icon && (
        <Icon
          name={icon}
          size={
            size === "sm" || size === "tree" ? 14 : size === "toolbar" ? 18 : 16
          }
        />
      )}
      {children}
    </button>
  );
}
export function Clip({
  children,
  className = "",
}: React.PropsWithChildren<{
  className?: string;
}>) {
  const ref = useRef<HTMLSpanElement>(null),
    [clipped, setClipped] = useState(false),
    text = typeof children === "string" ? children : undefined;
  useEffect(() => {
    const e = ref.current!,
      update = () =>
        setClipped(
          e.scrollWidth > e.clientWidth + 1 ||
            e.scrollHeight > e.clientHeight + 1,
        );
    update();
    const o = new ResizeObserver(update);
    o.observe(e);
    return () => o.disconnect();
  }, [children]);
  return (
    <span
      ref={ref}
      className={"el-clip " + className}
      title={clipped ? text : undefined}
    >
      {children}
    </span>
  );
}
export function Link({
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="el-link"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      {...props}
    >
      {children}
      <span aria-hidden="true" className="el-link-arrow">
        →
      </span>
    </button>
  );
}
export function Menu({
  label,
  icon = "more",
  children,
  items,
  disabled,
  search,
  size,
}: React.PropsWithChildren<{
  label: string;
  icon?: string;
  items: MenuItem[];
  disabled?: boolean;
  search?: {
    label: string;
    value: string;
    onChange(value: string): void;
  };
  size?: "toolbar";
}>) {
  const [open, setOpen] = useState(false),
    trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null),
    [position, setPosition] = useState({ left: 0, top: 0 }),
    id = useId();
  const close = (focus = true) => {
    setOpen(false);
    if (focus) queueMicrotask(() => trigger.current?.focus());
  };
  useEffect(() => {
    if (!open) return;
    const r = trigger.current!.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(r.left, innerWidth - 252)),
      top: Math.min(
        r.bottom + 4,
        Math.max(8, innerHeight - Math.min(items.length * 38 + 16, 340)),
      ),
    });
    queueMicrotask(() =>
      menu.current
        ?.querySelector<HTMLElement>("input,[role^=menuitem]:not(:disabled)")
        ?.focus(),
    );
    const outside = (e: PointerEvent) => {
      if (
        !menu.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        close(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const keyboard = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      e.preventDefault();
      close(false);
      queueMicrotask(() => {
        const buttons = [
          ...document.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
          ),
        ].filter(
          (el) =>
            el.getClientRects().length &&
            !el.closest('.el-menu-layer,[aria-hidden="true"]'),
        );
        const i = buttons.indexOf(trigger.current!);
        (buttons[i + (e.shiftKey ? -1 : 1)] || trigger.current)?.focus();
      });
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      const buttons = [
          ...menu.current!.querySelectorAll<HTMLElement>(
            "[role^=menuitem]:not(:disabled)",
          ),
        ],
        i = buttons.indexOf(document.activeElement as HTMLElement);
      buttons[
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? buttons.length - 1
            : i < 0
              ? e.key === "ArrowUp"
                ? buttons.length - 1
                : 0
              : (i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                buttons.length
      ]?.focus();
    }
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        title={open ? undefined : label}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="menu"
        disabled={disabled}
        className={
          children
            ? "el-menu-trigger"
            : "el-icon-button" + (size ? " el-icon-button--" + size : "")
        }
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        {children || (
          <Icon name={icon} size={size === "toolbar" ? 18 : 16} />
        )}
        {children && <Icon name={open ? "up" : "down"} />}
      </button>
      {open &&
        createPortal(
          <div className="el-plugin el-menu-layer" style={position}>
            <div
              ref={menu}
              role="menu"
              id={id}
              aria-label={label}
              onKeyDown={keyboard}
            >
              {search && (
                <label className="el-search el-menu-search">
                  <Icon name="search" size={14} />
                  <input
                    aria-label={search.label}
                    placeholder={search.label}
                    value={search.value}
                    onChange={(e) => search.onChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (!["ArrowDown", "ArrowUp", "Escape"].includes(e.key))
                        e.stopPropagation();
                    }}
                  />
                </label>
              )}
              {items.map((item, i) =>
                item.separator ? (
                  <hr key={i} />
                ) : (
                  <button
                    key={i}
                    type="button"
                    role={item.checkbox ? "menuitemcheckbox" : "menuitem"}
                    aria-checked={
                      item.checkbox ? Boolean(item.selected) : undefined
                    }
                    aria-current={
                      !item.checkbox && item.selected ? "true" : undefined
                    }
                    disabled={item.disabled}
                    className={item.danger ? "el-danger" : ""}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!item.keepOpen) close();
                      item.action?.();
                    }}
                  >
                    <span className="el-menu-item-label">
                      {item.icon && <Icon name={item.icon} />}
                      {item.label}
                    </span>
                    {item.selected && <Icon name="check" />}
                    {item.note && <small>{item.note}</small>}
                  </button>
                ),
              )}
            </div>
          </div>,
          document.body,
        )}
   </>
  );
}
export function Dialog({
  title,
  children,
  close,
  className = "",
  anchor,
}: DialogProps) {
  const ref = useRef<HTMLElement>(null),
    id = useId(),
    before = useRef(document.activeElement as HTMLElement | null);
  const rect = anchor?.getBoundingClientRect(),
    position: React.CSSProperties | undefined = rect
      ? {
          position: "fixed",
          width: 280,
          left: Math.max(8, Math.min(rect.right - 280, innerWidth - 288)),
          top: Math.max(8, Math.min(rect.bottom + 6, innerHeight - 180)),
        }
      : undefined;
  useEffect(() => {
    queueMicrotask(() =>
      (
        ref.current?.querySelector<HTMLElement>("[data-autofocus]") ||
        ref.current?.querySelector<HTMLElement>("textarea,input,select") ||
        ref.current?.querySelector<HTMLElement>("button") ||
        ref.current
      )?.focus(),
    );
    return () => {
      if (before.current?.isConnected) before.current.focus();
    };
  }, []);
  const key = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.nativeEvent?.isComposing) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      close();
    }
    if (e.key === "Tab") {
      const list = [
        ...ref.current!.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
        ),
      ].filter((x) => x.getClientRects().length);
      if (!list.length) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey && document.activeElement === list[0]) {
        e.preventDefault();
        list.at(-1)!.focus();
      } else if (!e.shiftKey && document.activeElement === list.at(-1)) {
        e.preventDefault();
        list[0].focus();
      }
    }
  };
  return createPortal(
    <div
      className={
        "el-plugin el-dialog-mask" + (anchor ? " el-anchored-mask" : "")
      }
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        ref={ref}
        role={anchor ? "alertdialog" : "dialog"}
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={id}
        style={position}
        className={"el-dialog " + className}
        onKeyDown={key}
      >
        <header>
          <h2 id={id}>{title}</h2>
          <IconButton label="关闭" icon="close" size="sm" onClick={close} />
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
export function Confirm({
  title,
  children,
  action,
  close,
  confirm = "确认",
  danger = false,
  anchor,
}: DialogProps & {
  action: () => unknown;
  confirm?: string;
  danger?: boolean;
}) {
  return (
    <Dialog title={title} close={close} anchor={anchor}>
      <p>{children}</p>
      <footer>
        <button className="el-btn" data-autofocus onClick={close}>
          取消
        </button>
        <button
          className={danger ? "el-btn el-danger" : "el-btn"}
          onClick={action}
        >
          {confirm}
        </button>
      </footer>
    </Dialog>
  );
}
// Plain React nodes only: no raw HTML, external image loading or script execution.
// The same renderer is used for model prose, suggestions and extension previews.
export function Prose({ text = "" }: { text?: string }) {
  const blocks = String(text)
    .replace(/\r\n?/g, "\n")
    .split(/(```[^\n]*\n[\s\S]*?(?:```|$))/g)
    .filter(Boolean);
  const inline = (value: string) =>
    value
      .split(/(`[^`\n]+`)/g)
      .map((s, i) =>
        s.startsWith("`") && s.endsWith("`") ? (
          <code key={i}>{s.slice(1, -1)}</code>
        ) : (
          s
        ),
      );
  return (
    <div className="el-prose">
      {blocks.map((block, i) =>
        block.startsWith("```") ? (
          <pre key={i}>
            <code>
              {block.slice(block.indexOf("\n") + 1).replace(/```$/, "")}
            </code>
          </pre>
        ) : (
          block
            .split(/\n\s*\n/)
            .filter(Boolean)
            .map((p, j) => <p key={i + ":" + j}>{inline(p)}</p>)
        ),
      )}
    </div>
  );
}
export function localTime(value?: string | number) {
  return value
    ? new Date(value).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "时间不可用";
}
export function relativeTime(value: string | number) {
  const n = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(n)) return "";
  const m = Math.max(0, Math.floor((Date.now() - n) / 60000));
  return m < 1
    ? "刚刚"
    : m < 60
      ? m + "分钟前"
      : m < 1440
        ? Math.floor(m / 60) + "小时前"
        : Math.floor(m / 1440) + "天前";
}
export const basename = (p: string) => p.split("/").at(-1) || p;
