window.__ModuleLoader__.load({id:'dsh-evidentloop',factory:require=>{var module={exports:{}};var exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// plugin/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// plugin/shared/contracts.ts
var errorMessage = (error) => error instanceof Error ? error.message : String(error);

// plugin/client/index.tsx
var import_react8 = __toESM(require("react"), 1);

// plugin/client/app.tsx
var import_react7 = __toESM(require("react"), 1);

// plugin/client/list.tsx
var import_react2 = __toESM(require("react"), 1);

// plugin/client/ui.tsx
var import_react = __toESM(require("react"), 1);
var import_react_dom = require("react-dom");
function Icon({
  name: name2,
  size = 16,
  strokeWidth = 1.65
}) {
  const shapes = {
    search: /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("circle", { cx: "10", cy: "10", r: "6" }), /* @__PURE__ */ import_react.default.createElement("path", { d: "m15 15 5 5" })),
    brand: /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("circle", { cx: "11", cy: "11", r: "8" }), /* @__PURE__ */ import_react.default.createElement("path", { d: "m21 21-4.3-4.3M9 8.5l-2 2.5 2 2.5m4-5 2 2.5-2 2.5" })),
    settings: /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("path", { d: "m9 3-1 3-3 1-2 4 2 2-1 4 4 2 3-1 3 3 4-2v-4l3-2-1-4-3-1-1-4z" }), /* @__PURE__ */ import_react.default.createElement("circle", { cx: "12", cy: "12", r: "3" })),
    more: /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("circle", { cx: "5", cy: "12", r: ".8" }), /* @__PURE__ */ import_react.default.createElement("circle", { cx: "12", cy: "12", r: ".8" }), /* @__PURE__ */ import_react.default.createElement("circle", { cx: "19", cy: "12", r: ".8" })),
    chevronLeft: /* @__PURE__ */ import_react.default.createElement("path", { d: "m15 6-6 6 6 6" }),
    chevronRight: /* @__PURE__ */ import_react.default.createElement("path", { d: "m9 6 6 6-6 6" }),
    down: /* @__PURE__ */ import_react.default.createElement("path", { d: "m6 9 6 6 6-6" }),
    up: /* @__PURE__ */ import_react.default.createElement("path", { d: "m6 15 6-6 6 6" }),
    pin: /* @__PURE__ */ import_react.default.createElement("path", { d: "M4 4h16M12 21V8m-6 6 6-6 6 6" }),
    next: /* @__PURE__ */ import_react.default.createElement("path", { d: "M12 3v18m-7-7 7 7 7-7" }),
    grid: /* @__PURE__ */ import_react.default.createElement("path", { d: "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z" }),
    list: /* @__PURE__ */ import_react.default.createElement("path", { d: "M4 6h16M4 12h16M4 18h16" }),
    tree: /* @__PURE__ */ import_react.default.createElement("path", { d: "M5 3v13h14M5 8h14M12 5v6m0 2v6" }),
    split: /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("rect", { x: "3", y: "4", width: "18", height: "16", rx: "2" }), /* @__PURE__ */ import_react.default.createElement("path", { d: "M12 4v16" })),
    comment: /* @__PURE__ */ import_react.default.createElement("path", { d: "M4 4h16v12H9l-5 4z" }),
    ask: /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("path", { d: "m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z" })),
    minus: /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("circle", { cx: "12", cy: "12", r: "9" }), /* @__PURE__ */ import_react.default.createElement("path", { d: "M7 12h10" })),
    copy: /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("path", { d: "M8 8h13v13H8zM16 8V3H3v13h5" })),
    download: /* @__PURE__ */ import_react.default.createElement("path", { d: "M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3" }),
    back: /* @__PURE__ */ import_react.default.createElement("path", { d: "m14 4-8 8 8 8" }),
    close: /* @__PURE__ */ import_react.default.createElement("path", { d: "m5 5 14 14M19 5 5 19" }),
    folder: /* @__PURE__ */ import_react.default.createElement("path", { d: "M3 6h7l2 3h9v12H3z" }),
    check: /* @__PURE__ */ import_react.default.createElement("path", { d: "m4 12 5 5L20 6" })
  };
  return /* @__PURE__ */ import_react.default.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    shapes[name2] || shapes.more
  );
}
function IconButton({
  label,
  icon,
  children,
  size,
  className = "",
  ...props
}) {
  return /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      type: "button",
      className: [
        "el-icon-button",
        size && "el-icon-button--" + size,
        className
      ].filter(Boolean).join(" "),
      title: label,
      "aria-label": label,
      ...props
    },
    icon && /* @__PURE__ */ import_react.default.createElement(
      Icon,
      {
        name: icon,
        size: size === "sm" || size === "tree" ? 14 : size === "toolbar" ? 18 : 16,
        strokeWidth: size === "toolbar" ? 1.8 : 1.65
      }
    ),
    children
  );
}
function Clip({
  children,
  className = ""
}) {
  const ref = (0, import_react.useRef)(null), [clipped, setClipped] = (0, import_react.useState)(false), text = typeof children === "string" ? children : void 0;
  (0, import_react.useEffect)(() => {
    const e = ref.current, update = () => setClipped(
      e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1
    );
    update();
    const o = new ResizeObserver(update);
    o.observe(e);
    return () => o.disconnect();
  }, [children]);
  return /* @__PURE__ */ import_react.default.createElement(
    "span",
    {
      ref,
      className: "el-clip " + className,
      title: clipped ? text : void 0
    },
    children
  );
}
function Link({
  children,
  onClick,
  ...props
}) {
  return /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      type: "button",
      className: "el-link",
      onClick: (e) => {
        e.stopPropagation();
        onClick?.(e);
      },
      ...props
    },
    children,
    /* @__PURE__ */ import_react.default.createElement("span", { "aria-hidden": "true", className: "el-link-arrow" }, "\u2192")
  );
}
function Menu({
  label,
  icon = "more",
  children,
  items,
  disabled,
  search,
  size
}) {
  const [open, setOpen] = (0, import_react.useState)(false), trigger = (0, import_react.useRef)(null), menu = (0, import_react.useRef)(null), [position, setPosition] = (0, import_react.useState)({ left: 0, top: 0 }), id = (0, import_react.useId)();
  const close = (focus = true) => {
    setOpen(false);
    if (focus) queueMicrotask(() => trigger.current?.focus());
  };
  (0, import_react.useEffect)(() => {
    if (!open) return;
    const r = trigger.current.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(r.left, innerWidth - 252)),
      top: Math.min(
        r.bottom + 4,
        Math.max(8, innerHeight - Math.min(items.length * 38 + 16, 340))
      )
    });
    queueMicrotask(
      () => menu.current?.querySelector("input,[role^=menuitem]:not(:disabled)")?.focus()
    );
    const outside = (e) => {
      if (!menu.current?.contains(e.target) && !trigger.current?.contains(e.target))
        close(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const keyboard = (e) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      e.preventDefault();
      close(false);
      queueMicrotask(() => {
        const buttons = [
          ...document.querySelectorAll(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]'
          )
        ].filter(
          (el) => el.getClientRects().length && !el.closest('.el-menu-layer,[aria-hidden="true"]')
        );
        const i = buttons.indexOf(trigger.current);
        (buttons[i + (e.shiftKey ? -1 : 1)] || trigger.current)?.focus();
      });
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      const buttons = [
        ...menu.current.querySelectorAll(
          "[role^=menuitem]:not(:disabled)"
        )
      ], i = buttons.indexOf(document.activeElement);
      buttons[e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : i < 0 ? e.key === "ArrowUp" ? buttons.length - 1 : 0 : (i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    }
  };
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      ref: trigger,
      type: "button",
      "aria-label": label,
      title: open ? void 0 : label,
      "aria-expanded": open,
      "aria-controls": id,
      "aria-haspopup": "menu",
      disabled,
      className: children ? "el-menu-trigger" : "el-icon-button" + (size ? " el-icon-button--" + size : ""),
      onKeyDown: (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          setOpen(true);
        }
      },
      onClick: (e) => {
        e.stopPropagation();
        setOpen(!open);
      }
    },
    children || /* @__PURE__ */ import_react.default.createElement(
      Icon,
      {
        name: icon,
        size: size === "toolbar" ? 18 : 16,
        strokeWidth: size === "toolbar" ? 1.8 : 1.65
      }
    ),
    children && /* @__PURE__ */ import_react.default.createElement(Icon, { name: open ? "up" : "down" })
  ), open && (0, import_react_dom.createPortal)(
    /* @__PURE__ */ import_react.default.createElement("div", { className: "el-plugin el-menu-layer", style: position }, /* @__PURE__ */ import_react.default.createElement(
      "div",
      {
        ref: menu,
        role: "menu",
        id,
        "aria-label": label,
        onKeyDown: keyboard
      },
      search && /* @__PURE__ */ import_react.default.createElement(
        "input",
        {
          "aria-label": search.label,
          placeholder: search.label,
          value: search.value,
          onChange: (e) => search.onChange(e.target.value),
          onKeyDown: (e) => {
            if (!["ArrowDown", "ArrowUp", "Escape"].includes(e.key))
              e.stopPropagation();
          }
        }
      ),
      items.map(
        (item, i) => item.separator ? /* @__PURE__ */ import_react.default.createElement("hr", { key: i }) : /* @__PURE__ */ import_react.default.createElement(
          "button",
          {
            key: i,
            type: "button",
            role: item.checkbox ? "menuitemcheckbox" : "menuitem",
            "aria-checked": item.checkbox ? Boolean(item.selected) : void 0,
            "aria-current": !item.checkbox && item.selected ? "true" : void 0,
            disabled: item.disabled,
            className: item.danger ? "el-danger" : "",
            onClick: (e) => {
              e.stopPropagation();
              if (!item.keepOpen) close();
              item.action?.();
            }
          },
          /* @__PURE__ */ import_react.default.createElement("span", null, item.label),
          item.selected && /* @__PURE__ */ import_react.default.createElement(Icon, { name: "check" }),
          item.note && /* @__PURE__ */ import_react.default.createElement("small", null, item.note)
        )
      )
    )),
    document.body
  ));
}
function Dialog({
  title,
  children,
  close,
  className = "",
  anchor
}) {
  const ref = (0, import_react.useRef)(null), id = (0, import_react.useId)(), before = (0, import_react.useRef)(document.activeElement);
  const rect = anchor?.getBoundingClientRect(), position = rect ? {
    position: "fixed",
    width: 280,
    left: Math.max(8, Math.min(rect.right - 280, innerWidth - 288)),
    top: Math.max(8, Math.min(rect.bottom + 6, innerHeight - 180))
  } : void 0;
  (0, import_react.useEffect)(() => {
    queueMicrotask(
      () => (ref.current?.querySelector("[data-autofocus]") || ref.current?.querySelector("textarea,input,select") || ref.current?.querySelector("button") || ref.current)?.focus()
    );
    return () => {
      if (before.current?.isConnected) before.current.focus();
    };
  }, []);
  const key = (e) => {
    if (e.nativeEvent?.isComposing) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      close();
    }
    if (e.key === "Tab") {
      const list = [
        ...ref.current.querySelectorAll(
          "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]"
        )
      ].filter((x) => x.getClientRects().length);
      if (!list.length) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey && document.activeElement === list[0]) {
        e.preventDefault();
        list.at(-1).focus();
      } else if (!e.shiftKey && document.activeElement === list.at(-1)) {
        e.preventDefault();
        list[0].focus();
      }
    }
  };
  return (0, import_react_dom.createPortal)(
    /* @__PURE__ */ import_react.default.createElement(
      "div",
      {
        className: "el-plugin el-dialog-mask" + (anchor ? " el-anchored-mask" : ""),
        onPointerDown: (e) => {
          if (e.target === e.currentTarget) close();
        }
      },
      /* @__PURE__ */ import_react.default.createElement(
        "section",
        {
          ref,
          role: anchor ? "alertdialog" : "dialog",
          tabIndex: -1,
          "aria-modal": "true",
          "aria-labelledby": id,
          style: position,
          className: "el-dialog " + className,
          onKeyDown: key
        },
        /* @__PURE__ */ import_react.default.createElement("header", null, /* @__PURE__ */ import_react.default.createElement("h2", { id }, title), /* @__PURE__ */ import_react.default.createElement(IconButton, { label: "\u5173\u95ED", icon: "close", size: "sm", onClick: close })),
        children
      )
    ),
    document.body
  );
}
function Confirm({
  title,
  children,
  action,
  close,
  confirm = "\u786E\u8BA4",
  danger = false,
  anchor
}) {
  return /* @__PURE__ */ import_react.default.createElement(Dialog, { title, close, anchor }, /* @__PURE__ */ import_react.default.createElement("p", null, children), /* @__PURE__ */ import_react.default.createElement("footer", null, /* @__PURE__ */ import_react.default.createElement("button", { className: "el-btn", "data-autofocus": true, onClick: close }, "\u53D6\u6D88"), /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      className: danger ? "el-btn el-danger" : "el-btn",
      onClick: action
    },
    confirm
  )));
}
function Prose({ text = "" }) {
  const blocks = String(text).replace(/\r\n?/g, "\n").split(/(```[^\n]*\n[\s\S]*?(?:```|$))/g).filter(Boolean);
  const inline = (value) => value.split(/(`[^`\n]+`)/g).map(
    (s, i) => s.startsWith("`") && s.endsWith("`") ? /* @__PURE__ */ import_react.default.createElement("code", { key: i }, s.slice(1, -1)) : s
  );
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "el-prose" }, blocks.map(
    (block, i) => block.startsWith("```") ? /* @__PURE__ */ import_react.default.createElement("pre", { key: i }, /* @__PURE__ */ import_react.default.createElement("code", null, block.slice(block.indexOf("\n") + 1).replace(/```$/, ""))) : block.split(/\n\s*\n/).filter(Boolean).map((p, j) => /* @__PURE__ */ import_react.default.createElement("p", { key: i + ":" + j }, inline(p)))
  ));
}
function localTime(value) {
  return value ? new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }) : "\u65F6\u95F4\u4E0D\u53EF\u7528";
}
function relativeTime(value) {
  const n = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(n)) return "";
  const m = Math.max(0, Math.floor((Date.now() - n) / 6e4));
  return m < 1 ? "\u521A\u521A" : m < 60 ? m + "\u5206\u949F\u524D" : m < 1440 ? Math.floor(m / 60) + "\u5C0F\u65F6\u524D" : Math.floor(m / 1440) + "\u5929\u524D";
}
var basename = (p) => p.split("/").at(-1) || p;

// plugin/client/list.tsx
function WorkspacePicker({ runtime, state }) {
  const [query, setQuery] = import_react2.default.useState("");
  const current = state.data?.workspaces.find(
    (w) => w.workspaceId === state.workspaceId
  );
  const items = (state.data?.workspaces || []).filter(
    (w) => (w.title + " " + w.path).toLowerCase().includes(query.toLowerCase())
  ).map((w) => ({
    label: w.title,
    note: w.notGit ? "\u4E0D\u662FGit\u4ED3\u5E93" : w.path,
    selected: w.workspaceId === state.workspaceId,
    action: () => runtime.perform(() => runtime.selectWorkspace(w.workspaceId))
  }));
  return /* @__PURE__ */ import_react2.default.createElement("div", { className: "el-workspace-picker" }, /* @__PURE__ */ import_react2.default.createElement(
    Menu,
    {
      label: "\u5207\u6362\u5DE5\u4F5C\u533A",
      items,
      search: { label: "\u641C\u7D22\u5DE5\u4F5C\u533A", value: query, onChange: setQuery }
    },
    current?.title || "\u9009\u62E9\u5DE5\u4F5C\u533A"
  ));
}
function DeliveryList({ runtime, state }) {
  const {
    archived = false,
    onlyIssues = false,
    sort = "updated",
    compact = false
  } = state.listPreferences || {}, [deleting, setDeleting] = import_react2.default.useState(null);
  const preference = (key, value) => runtime.update({
    listPreferences: { ...runtime.state.listPreferences, [key]: value }
  });
  const setArchived = (value) => preference("archived", value), setOnlyIssues = (value) => preference("onlyIssues", value), setSort = (value) => preference("sort", value), setCompact = (value) => preference("compact", value);
  const data = state.data, all = data?.deliveries || [], query = (state.query || "").trim().toLowerCase();
  const sessions = new Map((data?.sessions || []).map((s) => [s.sessionId, s]));
  const sessionFor = (d) => sessions.get(d.sessionIds.at(-1) || "");
  const updated = (d) => Math.max(
    Date.parse(d.snapshot?.createdAt || d.createdAt) || 0,
    Number(sessionFor(d)?.updatedAt) || 0
  );
  const list = all.filter((d) => Boolean(d.archivedAt) === archived).filter((d) => !onlyIssues || d.activeFindingCount > 0).filter(
    (d) => [d.title, d.branch, d.externalRef].some(
      (v) => (v || "").toLowerCase().includes(query)
    )
  ).sort(
    (a, b) => Number(Boolean(b.pinnedAt)) - Number(Boolean(a.pinnedAt)) || (sort === "issues" ? b.activeFindingCount - a.activeFindingCount : 0) || updated(b) - updated(a)
  );
  const busy = (d) => ["running", "queued"].includes(d.run?.status || "");
  const mutate = async (d, action, value) => {
    await runtime.api("delivery", {
      workspaceId: runtime.workspaceId(),
      deliveryId: d.deliveryId,
      action,
      value
    });
    await runtime.refresh();
  };
  const menu = (d) => /* @__PURE__ */ import_react2.default.createElement(
    Menu,
    {
      label: "\u66F4\u591A\u64CD\u4F5C\uFF1A" + d.title,
      items: [
        ...!d.archivedAt ? [
          {
            label: d.pinnedAt ? "\u53D6\u6D88\u7F6E\u9876" : "\u7F6E\u9876",
            action: () => runtime.perform(() => mutate(d, "pin", !d.pinnedAt))
          }
        ] : [],
        {
          label: d.archivedAt ? "\u53D6\u6D88\u5F52\u6863" : "\u5F52\u6863",
          disabled: busy(d),
          note: busy(d) ? "\u5BA1\u67E5\u8FDB\u884C\u4E2D\uFF0C\u5B8C\u6210\u540E\u53EF\u5F52\u6863" : void 0,
          action: () => runtime.perform(() => mutate(d, "archive", !d.archivedAt))
        },
        { separator: true },
        {
          label: "\u5220\u9664",
          danger: true,
          disabled: busy(d),
          note: busy(d) ? "\u5148\u53D6\u6D88\u5BA1\u67E5\u518D\u5220\u9664" : void 0,
          action: () => setDeleting(d)
        }
      ]
    }
  );
  const title = (d) => /* @__PURE__ */ import_react2.default.createElement(
    "button",
    {
      className: "el-title-link",
      onClick: (e) => {
        e.stopPropagation();
        runtime.perform(() => runtime.open(d.deliveryId));
      }
    },
    d.pinnedAt && !d.archivedAt && /* @__PURE__ */ import_react2.default.createElement("span", { className: "el-pin", title: "\u5DF2\u7F6E\u9876", "aria-label": "\u5DF2\u7F6E\u9876" }, /* @__PURE__ */ import_react2.default.createElement(Icon, { name: "pin", size: 14 })),
    /* @__PURE__ */ import_react2.default.createElement(Clip, null, d.title)
  );
  const session = (d) => {
    const s = sessionFor(d);
    return s ? s.archived || s.unavailable ? /* @__PURE__ */ import_react2.default.createElement(
      "span",
      {
        className: "el-session-static",
        onClick: (e) => e.stopPropagation(),
        title: s.unavailable ? "\u8BE5\u4F1A\u8BDD\u9700\u8981\u8FC1\u79FB\u6216\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u5148\u5728\u4F1A\u8BDD\u5217\u8868\u5904\u7406" : "\u8BE5\u4F1A\u8BDD\u5DF2\u5F52\u6863\uFF0C\u53D6\u6D88\u5F52\u6863\u540E\u53EF\u67E5\u770B"
      },
      /* @__PURE__ */ import_react2.default.createElement(Clip, null, s.title + (s.unavailable ? "\uFF08\u4F1A\u8BDD\u4E0D\u53EF\u7528\uFF09" : "\uFF08\u4F1A\u8BDD\u5DF2\u5F52\u6863\uFF09"))
    ) : /* @__PURE__ */ import_react2.default.createElement(
      Link,
      {
        onClick: () => runtime.perform(() => runtime.native.openSession(s.sessionId)),
        "aria-label": "\u6253\u5F00\u4F1A\u8BDD\uFF1A" + s.title
      },
      /* @__PURE__ */ import_react2.default.createElement(Icon, { name: "comment" }),
      /* @__PURE__ */ import_react2.default.createElement(Clip, null, s.title),
      /* @__PURE__ */ import_react2.default.createElement("span", { className: "el-narrow-session" }, "\u4F1A\u8BDD")
    ) : /* @__PURE__ */ import_react2.default.createElement("span", { className: "el-muted el-no-session" }, "\u65E0\u5173\u8054\u4F1A\u8BDD");
  };
  return /* @__PURE__ */ import_react2.default.createElement("section", { className: "el-delivery-area" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "el-list-controls" }, /* @__PURE__ */ import_react2.default.createElement("div", { role: "group", "aria-label": "\u4EA4\u4ED8\u8303\u56F4" }, /* @__PURE__ */ import_react2.default.createElement(
    "button",
    {
      className: "el-btn",
      "aria-pressed": !archived,
      onClick: () => setArchived(false)
    },
    "\u5168\u90E8 ",
    /* @__PURE__ */ import_react2.default.createElement("span", null, all.filter((d) => !d.archivedAt).length)
  ), /* @__PURE__ */ import_react2.default.createElement(
    "button",
    {
      className: "el-btn",
      "aria-pressed": archived,
      onClick: () => setArchived(true)
    },
    "\u5F52\u6863 ",
    /* @__PURE__ */ import_react2.default.createElement("span", null, all.filter((d) => d.archivedAt).length)
  )), /* @__PURE__ */ import_react2.default.createElement("label", null, /* @__PURE__ */ import_react2.default.createElement(
    "input",
    {
      type: "checkbox",
      checked: onlyIssues,
      onChange: (e) => setOnlyIssues(e.target.checked)
    }
  ), "\u53EA\u770B\u6709\u95EE\u9898"), /* @__PURE__ */ import_react2.default.createElement("span", { className: "el-header-spacer" }), /* @__PURE__ */ import_react2.default.createElement(
    Menu,
    {
      label: "\u6392\u5E8F",
      items: [
        {
          label: "\u6700\u8FD1\u66F4\u65B0",
          selected: sort === "updated",
          action: () => setSort("updated")
        },
        {
          label: "\u95EE\u9898\u6700\u591A",
          selected: sort === "issues",
          action: () => setSort("issues")
        }
      ]
    },
    sort === "updated" ? "\u6700\u8FD1\u66F4\u65B0" : "\u95EE\u9898\u6700\u591A"
  ), /* @__PURE__ */ import_react2.default.createElement("div", { role: "group", "aria-label": "\u4EA4\u4ED8\u89C6\u56FE" }, /* @__PURE__ */ import_react2.default.createElement(
    IconButton,
    {
      label: "\u7F51\u683C\u89C6\u56FE",
      icon: "grid",
      "aria-pressed": !compact,
      onClick: () => setCompact(false)
    }
  ), /* @__PURE__ */ import_react2.default.createElement(
    IconButton,
    {
      label: "\u7D27\u51D1\u89C6\u56FE",
      icon: "list",
      "aria-pressed": compact,
      onClick: () => setCompact(true)
    }
  ))), !state.workspaceId ? /* @__PURE__ */ import_react2.default.createElement("section", { className: "el-empty" }, "\u9009\u62E9\u4E00\u4E2A\u771F\u5B9E\u5DE5\u4F5C\u533A\u67E5\u770B\u4EA4\u4ED8\u3002") : data?.project?.notGit ? /* @__PURE__ */ import_react2.default.createElement("section", { className: "el-empty" }, "\u5F53\u524D\u5DE5\u4F5C\u533A\u4E0D\u662FGit\u4ED3\u5E93\u3002\u8BF7\u9009\u62E9\u4E00\u4E2AGit\u5DE5\u4F5C\u533A\u3002") : !all.length ? /* @__PURE__ */ import_react2.default.createElement("section", { className: "el-empty" }, /* @__PURE__ */ import_react2.default.createElement("p", null, "\u5F53\u524D\u5DE5\u4F5C\u533A\u8FD8\u6CA1\u6709\u4EA4\u4ED8\u3002"), /* @__PURE__ */ import_react2.default.createElement("p", null, "\u4ECE\u5F00\u53D1\u4F1A\u8BDD\u8F6E\u6B21\u7ED3\u675F\u5904\u7684\u8BC4\u5BA1\u5361\u7247\u8FDB\u5165\uFF0C\u67E5\u770B\u672C\u6B21\u53D8\u66F4\u3002")) : /* @__PURE__ */ import_react2.default.createElement(import_react2.default.Fragment, null, /* @__PURE__ */ import_react2.default.createElement(
    "div",
    {
      className: compact ? "el-compact-scroll" : "el-card-scroll",
      tabIndex: compact ? 0 : void 0,
      "aria-label": compact ? "\u4EA4\u4ED8\u5217\u8868\uFF0C\u7A84\u7A97\u53E3\u53EF\u6A2A\u5411\u6EDA\u52A8" : void 0
    },
    compact ? /* @__PURE__ */ import_react2.default.createElement(
      "div",
      {
        role: "table",
        className: "el-compact-table",
        "aria-label": "\u4EA4\u4ED8\u5217\u8868"
      },
      /* @__PURE__ */ import_react2.default.createElement("div", { role: "row", className: "el-compact-head" }, /* @__PURE__ */ import_react2.default.createElement("span", { role: "columnheader" }, "\u540D\u79F0"), /* @__PURE__ */ import_react2.default.createElement("span", { role: "columnheader", className: "el-col-branch" }, "\u5206\u652F"), /* @__PURE__ */ import_react2.default.createElement("span", { role: "columnheader" }, "\u5BA1\u67E5\u7ED3\u679C"), /* @__PURE__ */ import_react2.default.createElement("span", { role: "columnheader" }, "\u6700\u8FD1\u4F1A\u8BDD"), /* @__PURE__ */ import_react2.default.createElement("span", { role: "columnheader", className: "el-col-updated" }, "\u66F4\u65B0"), /* @__PURE__ */ import_react2.default.createElement("span", { role: "columnheader" }, "\u8BF4\u660E"), /* @__PURE__ */ import_react2.default.createElement("span", { role: "columnheader", "aria-label": "\u83DC\u5355" })),
      list.map((d) => /* @__PURE__ */ import_react2.default.createElement(
        "article",
        {
          role: "row",
          className: "el-compact-row",
          key: d.deliveryId,
          onClick: (e) => {
            if (!e.target.closest("button,a"))
              runtime.perform(() => runtime.open(d.deliveryId));
          }
        },
        /* @__PURE__ */ import_react2.default.createElement("div", { role: "cell", className: "el-col-name" }, title(d), /* @__PURE__ */ import_react2.default.createElement("span", { className: "el-inline-branch" }, /* @__PURE__ */ import_react2.default.createElement(Clip, null, d.branch || "\u5206\u652F\u4FE1\u606F\u4E0D\u53EF\u7528"))),
        /* @__PURE__ */ import_react2.default.createElement("span", { role: "cell", className: "el-col-branch el-path" }, /* @__PURE__ */ import_react2.default.createElement(Clip, null, d.branch || "\u5206\u652F\u4FE1\u606F\u4E0D\u53EF\u7528")),
        /* @__PURE__ */ import_react2.default.createElement("span", { role: "cell", className: "el-result" }, /* @__PURE__ */ import_react2.default.createElement(Clip, null, d.statusText)),
        /* @__PURE__ */ import_react2.default.createElement("div", { role: "cell", className: "el-col-session" }, session(d)),
        /* @__PURE__ */ import_react2.default.createElement("span", { role: "cell", className: "el-col-updated el-muted" }, relativeTime(updated(d))),
        /* @__PURE__ */ import_react2.default.createElement("div", { role: "cell" }, /* @__PURE__ */ import_react2.default.createElement(
          Link,
          {
            onClick: () => runtime.perform(
              () => runtime.open(d.deliveryId, "overview")
            )
          },
          "\u53D8\u66F4\u8BF4\u660E"
        )),
        /* @__PURE__ */ import_react2.default.createElement("div", { role: "cell" }, menu(d))
      ))
    ) : /* @__PURE__ */ import_react2.default.createElement("div", { className: "el-delivery-grid" }, list.map((d) => /* @__PURE__ */ import_react2.default.createElement(
      "article",
      {
        className: "el-delivery-card",
        key: d.deliveryId,
        onClick: (e) => {
          if (!e.target.closest("button,a"))
            runtime.perform(() => runtime.open(d.deliveryId));
        }
      },
      /* @__PURE__ */ import_react2.default.createElement("h2", null, title(d)),
      /* @__PURE__ */ import_react2.default.createElement("p", { className: "el-card-meta" }, /* @__PURE__ */ import_react2.default.createElement(Clip, { className: "el-path" }, d.branch || "\u5206\u652F\u4FE1\u606F\u4E0D\u53EF\u7528"), /* @__PURE__ */ import_react2.default.createElement("span", null, relativeTime(updated(d)))),
      /* @__PURE__ */ import_react2.default.createElement("p", { className: "el-result" }, d.statusText),
      d.run?.understanding?.overview.purpose && /* @__PURE__ */ import_react2.default.createElement("p", { className: "el-clamp el-card-summary" }, d.run.understanding.overview.purpose),
      /* @__PURE__ */ import_react2.default.createElement("footer", null, session(d), /* @__PURE__ */ import_react2.default.createElement(
        Link,
        {
          onClick: () => runtime.perform(
            () => runtime.open(d.deliveryId, "overview")
          )
        },
        "\u53D8\u66F4\u8BF4\u660E"
      )),
      /* @__PURE__ */ import_react2.default.createElement("div", { className: "el-card-menu" }, menu(d))
    )))
  ), !list.length && /* @__PURE__ */ import_react2.default.createElement("section", { className: "el-empty" }, "\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u4EA4\u4ED8\u3002", /* @__PURE__ */ import_react2.default.createElement(
    "button",
    {
      className: "el-btn",
      onClick: () => {
        runtime.update({ query: "" });
        setOnlyIssues(false);
      }
    },
    "\u6E05\u7A7A\u641C\u7D22\u4E0E\u7B5B\u9009"
  ))), deleting && /* @__PURE__ */ import_react2.default.createElement(
    Confirm,
    {
      title: "\u786E\u8BA4\u5220\u9664\u6B64\u4EA4\u4ED8\u8BB0\u5F55\uFF1F",
      close: () => setDeleting(null),
      confirm: "\u5220\u9664",
      danger: true,
      action: () => runtime.perform(async () => {
        await runtime.api("delivery", {
          workspaceId: runtime.workspaceId(),
          deliveryId: deleting.deliveryId,
          action: "delete",
          confirm: "delete"
        });
        setDeleting(null);
        await runtime.refresh();
      })
    },
    "\u4F1A\u4E00\u5E76\u5220\u9664\u5B83\u7684\u5BA1\u67E5\u8BB0\u5F55\u3001\u95EE\u9898\u5904\u7F6E\u4E0E\u6279\u6CE8\uFF0C\u4E0D\u80FD\u6062\u590D\u3002"
  ));
}

// plugin/client/review.tsx
var import_react5 = __toESM(require("react"), 1);

// plugin/client/overview.tsx
var import_react3 = __toESM(require("react"), 1);
function Refs({
  refs = [],
  jump
}) {
  return /* @__PURE__ */ import_react3.default.createElement("span", { className: "el-refs" }, refs.map((r, i) => /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      key: i,
      className: "el-ref",
      title: r.path + (r.side === "base" ? " \xB7 \u65E7\u4EE3\u7801" : " \xB7 \u65B0\u4EE3\u7801"),
      onClick: () => jump({ ...r, line: r.startLine ?? r.line })
    },
    basename(r.path),
    r.startLine || r.line ? ":" + (r.startLine || r.line) : ""
  )));
}
var labels = {
  implemented: "\u5DF2\u5BF9\u9F50",
  partial: "\u90E8\u5206\u5BF9\u9F50",
  "not-found": "\u672A\u627E\u5230\u5B9E\u73B0",
  unclear: "\u5F85\u786E\u8BA4",
  superseded: "\u5DF2\u8C03\u6574"
};
function Overview({
  runtime,
  record,
  jump
}) {
  const u = record.run?.understanding, findings = record.run?.findings || [], suppressed = new Set(
    record.marks.filter((m) => m.suppressed).map((m) => m.findingId)
  ), active = findings.filter((f) => !suppressed.has(f.findingId)), [mode, setMode] = import_react3.default.useState("severity"), [adding, setAdding] = import_react3.default.useState(false);
  const features = u?.features || [], requirements = record.snapshot.requirements, requirementMap = new Map(
    requirements.flatMap(
      (s) => s.items.map((i) => [
        i.itemId,
        { ...i, text: Array.from(s.text).slice(i.start, i.end).join("") }
      ])
    )
  );
  const scroll = (id) => document.getElementById(id)?.scrollIntoView({
    block: "start",
    behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "instant" : "smooth"
  });
  const requirementJump = (id) => {
    const section = document.getElementById(
      "overview-requirements"
    );
    section.open = true;
    queueMicrotask(() => scroll("req-" + id));
  };
  const alignment = (row) => /* @__PURE__ */ import_react3.default.createElement("article", { key: row.requirementItemId, className: "el-alignment" }, /* @__PURE__ */ import_react3.default.createElement("p", null, /* @__PURE__ */ import_react3.default.createElement("span", { className: "el-dot" }), labels[row.status], " \xB7 ", requirementMap.get(row.requirementItemId)?.text), row.status === "superseded" && row.supersededBy && /* @__PURE__ */ import_react3.default.createElement("p", null, "\u540E\u7EED\u8981\u6C42\uFF1A", /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      className: "el-ref",
      onClick: () => requirementJump(row.supersededBy)
    },
    row.supersededQuote
  )), /* @__PURE__ */ import_react3.default.createElement(Prose, { text: row.note }), /* @__PURE__ */ import_react3.default.createElement(Refs, { refs: row.codeRefs, jump }));
  const group = (title, rows, folded = false) => folded ? /* @__PURE__ */ import_react3.default.createElement("details", { className: "el-alignment-group" }, /* @__PURE__ */ import_react3.default.createElement("summary", null, title, " \xB7 ", rows.length), rows.map(alignment)) : /* @__PURE__ */ import_react3.default.createElement("div", { className: "el-alignment-group" }, /* @__PURE__ */ import_react3.default.createElement("h3", null, title, " \xB7 ", rows.length), rows.map(alignment));
  const byFile = /* @__PURE__ */ new Map();
  for (const f of active) {
    if (!byFile.has(f.anchor.path)) byFile.set(f.anchor.path, []);
    byFile.get(f.anchor.path).push(f);
  }
  const coverage = record.run?.coverage, covList = (name2, rows = []) => /* @__PURE__ */ import_react3.default.createElement("div", { className: "el-coverage-group" }, /* @__PURE__ */ import_react3.default.createElement("h3", null, name2, " \xB7 ", rows.length), /* @__PURE__ */ import_react3.default.createElement("ul", null, rows.map((v, i) => {
    const p = typeof v === "string" ? v : v.path;
    return /* @__PURE__ */ import_react3.default.createElement("li", { key: i }, /* @__PURE__ */ import_react3.default.createElement(Refs, { refs: p ? [{ path: p }] : [], jump }), typeof v === "object" && v.reason && /* @__PURE__ */ import_react3.default.createElement("span", { className: "el-muted" }, " \xB7 ", v.reason));
  })));
  return /* @__PURE__ */ import_react3.default.createElement("div", { className: "el-overview" }, /* @__PURE__ */ import_react3.default.createElement("section", { id: "overview-conclusion", className: "el-hero" }, /* @__PURE__ */ import_react3.default.createElement("h2", null, "\u7ED3\u8BBA", " ", u && /* @__PURE__ */ import_react3.default.createElement("small", { className: "el-basis" }, u.overview.basis === "fact" ? "\u4EE3\u7801\u4E8B\u5B9E" : "\u6A21\u578B\u63A8\u65AD")), /* @__PURE__ */ import_react3.default.createElement(
    Prose,
    {
      text: u?.overview.purpose || "\u4EE3\u7801\u5DF2\u51BB\u7ED3\uFF0C\u5C1A\u65E0\u901A\u8FC7\u6821\u9A8C\u7684\u53D8\u66F4\u8BF4\u660E\u3002"
    }
  ), /* @__PURE__ */ import_react3.default.createElement("div", { className: "el-stat-pills" }, /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      className: "el-btn",
      onClick: () => scroll("overview-problems")
    },
    active.length || record.run?.complete ? active.length : "\u5F85\u5BA1",
    " ",
    "\u95EE\u9898"
  ), /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      className: "el-btn",
      onClick: () => scroll("overview-features")
    },
    features.length,
    " \u529F\u80FD"
  ), /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      className: "el-btn",
      onClick: () => scroll("overview-alignment")
    },
    (u?.alignment || []).filter((x) => x.status === "implemented").length,
    " ",
    "\u5DF2\u5BF9\u9F50"
  ), /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      className: "el-btn",
      onClick: () => scroll("overview-coverage")
    },
    coverage?.reviewed.length || 0,
    " \u8986\u76D6\u6587\u4EF6"
  )), /* @__PURE__ */ import_react3.default.createElement("div", { className: "panel-status", role: "status" }, record.statusText, record.annotations.length > 0 ? " \xB7 " + record.annotations.length + " \u6761\u6279\u6CE8" : ""), record.run?.errorCode && /* @__PURE__ */ import_react3.default.createElement("p", { className: "el-error" }, record.run.errorCode), features.length > 0 && /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, /* @__PURE__ */ import_react3.default.createElement("h3", null, "\u672C\u6B21\u6539\u52A8"), /* @__PURE__ */ import_react3.default.createElement("ul", { className: "el-change-list" }, features.slice(0, 5).map((f) => /* @__PURE__ */ import_react3.default.createElement("li", { key: f.featureId }, /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      className: "el-ref",
      onClick: () => scroll("feature-" + f.featureId)
    },
    f.title
  ), /* @__PURE__ */ import_react3.default.createElement("span", null, "\uFF1A", f.approach), " ", /* @__PURE__ */ import_react3.default.createElement("small", { className: "el-muted" }, "\uFF08", new Set(f.files).size, " \u4E2A\u6587\u4EF6\uFF09")))))), /* @__PURE__ */ import_react3.default.createElement("section", { id: "overview-features" }, /* @__PURE__ */ import_react3.default.createElement("h2", null, "\u6309\u529F\u80FD\u7684\u53D8\u66F4 ", u && /* @__PURE__ */ import_react3.default.createElement("small", { className: "el-basis" }, "\u6A21\u578B\u63A8\u65AD")), features.length ? features.map((f) => /* @__PURE__ */ import_react3.default.createElement(
    "article",
    {
      className: "el-feature",
      key: f.featureId,
      id: "feature-" + f.featureId
    },
    /* @__PURE__ */ import_react3.default.createElement("h3", null, f.title),
    /* @__PURE__ */ import_react3.default.createElement(Prose, { text: f.purpose }),
    /* @__PURE__ */ import_react3.default.createElement(Prose, { text: f.approach }),
    /* @__PURE__ */ import_react3.default.createElement(Refs, { refs: f.refs, jump }),
    (u?.impacts || []).filter((i) => i.refs.some((r) => f.files.includes(r.path))).map((impact, i) => /* @__PURE__ */ import_react3.default.createElement(Prose, { key: i, text: impact.text })),
    /* @__PURE__ */ import_react3.default.createElement("details", null, /* @__PURE__ */ import_react3.default.createElement("summary", null, new Set(f.files).size, " \u4E2A\u76F8\u5173\u6587\u4EF6"), /* @__PURE__ */ import_react3.default.createElement("ul", null, [...new Set(f.files)].map((path) => /* @__PURE__ */ import_react3.default.createElement("li", { key: path }, /* @__PURE__ */ import_react3.default.createElement(Refs, { refs: [{ path }], jump })))))
  )) : /* @__PURE__ */ import_react3.default.createElement("p", { className: "el-muted" }, u ? "\u672C\u6B21\u6CA1\u6709\u53EF\u5F52\u7EB3\u7684\u529F\u80FD\u6761\u76EE\u3002" : "\u5BA1\u67E5\u540E\u5C55\u793A\u901A\u8FC7\u6821\u9A8C\u7684\u529F\u80FD\u8BF4\u660E\u3002")), /* @__PURE__ */ import_react3.default.createElement("section", { id: "overview-alignment" }, /* @__PURE__ */ import_react3.default.createElement("h2", null, "\u9700\u6C42\u5BF9\u9F50", " ", u && requirements.length > 0 && /* @__PURE__ */ import_react3.default.createElement("small", { className: "el-basis" }, "\u6A21\u578B\u63A8\u65AD")), !requirements.length ? /* @__PURE__ */ import_react3.default.createElement("p", null, "\u672A\u63D0\u4F9B\u9700\u6C42\u4F9D\u636E") : !u ? /* @__PURE__ */ import_react3.default.createElement("p", null, "\u5BA1\u67E5\u5168\u90E8\u540E\u66F4\u65B0\u5BF9\u9F50\u5224\u65AD\u3002") : /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, group(
    "\u672A\u5BF9\u9F50 / \u5F85\u786E\u8BA4",
    u.alignment.filter(
      (r) => !["implemented", "superseded"].includes(r.status)
    )
  ), group(
    "\u5DF2\u5BF9\u9F50",
    u.alignment.filter((r) => r.status === "implemented"),
    true
  ), group(
    "\u5DF2\u8C03\u6574",
    u.alignment.filter((r) => r.status === "superseded"),
    true
  ), u.extras.length > 0 && /* @__PURE__ */ import_react3.default.createElement("div", null, /* @__PURE__ */ import_react3.default.createElement("h3", null, "\u9700\u6C42\u5916\u6539\u52A8"), u.extras.map((e, i) => /* @__PURE__ */ import_react3.default.createElement("article", { key: i }, /* @__PURE__ */ import_react3.default.createElement(Prose, { text: e.text }), /* @__PURE__ */ import_react3.default.createElement(Refs, { refs: e.refs, jump })))))), /* @__PURE__ */ import_react3.default.createElement("section", { id: "overview-problems" }, /* @__PURE__ */ import_react3.default.createElement("header", { className: "el-section-heading" }, /* @__PURE__ */ import_react3.default.createElement("h2", null, "\u95EE\u9898"), /* @__PURE__ */ import_react3.default.createElement("div", { role: "group", "aria-label": "\u95EE\u9898\u5206\u7EC4" }, /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      className: "el-btn",
      "aria-pressed": mode === "severity",
      onClick: () => setMode("severity")
    },
    "\u6309\u4E25\u91CD\u5EA6"
  ), /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      className: "el-btn",
      "aria-pressed": mode === "file",
      onClick: () => setMode("file")
    },
    "\u6309\u6587\u4EF6"
  ))), record.annotations.length > 0 && /* @__PURE__ */ import_react3.default.createElement("details", null, /* @__PURE__ */ import_react3.default.createElement("summary", null, "\u6279\u6CE8 ", record.annotations.length), record.annotations.map((a) => /* @__PURE__ */ import_react3.default.createElement("article", { key: a.annotationId }, /* @__PURE__ */ import_react3.default.createElement(
    Refs,
    {
      refs: [{ ...a.anchor, line: a.anchor.startLine }],
      jump
    }
  ), /* @__PURE__ */ import_react3.default.createElement(Prose, { text: a.text })))), !active.length && /* @__PURE__ */ import_react3.default.createElement("p", null, record.statusText), (mode === "severity" ? ["P0", "P1", "P2"].map(
    (s) => [s, active.filter((f) => f.severity === s)]
  ) : [...byFile]).filter(([, fs]) => fs.length).map(([name2, fs]) => /* @__PURE__ */ import_react3.default.createElement(
    "div",
    {
      className: "overview-problem-group",
      "data-severity": mode === "severity" ? name2 : void 0,
      key: name2
    },
    /* @__PURE__ */ import_react3.default.createElement("h3", { className: mode === "file" ? "el-path" : "" }, name2, " \xB7 ", fs.length),
    /* @__PURE__ */ import_react3.default.createElement("ul", null, fs.map((f) => /* @__PURE__ */ import_react3.default.createElement("li", { key: f.findingId }, /* @__PURE__ */ import_react3.default.createElement(
      "button",
      {
        className: "el-problem-link",
        "data-severity": f.severity,
        onClick: () => jump({ ...f.anchor, findingId: f.findingId })
      },
      /* @__PURE__ */ import_react3.default.createElement("span", null, f.severity),
      /* @__PURE__ */ import_react3.default.createElement("span", null, f.title),
      mode === "severity" && /* @__PURE__ */ import_react3.default.createElement("small", { className: "el-path" }, f.anchor.path)
    ))))
  )), (coverage?.withheld.length || 0) > 0 && /* @__PURE__ */ import_react3.default.createElement("p", { className: "el-withheld" }, coverage.withheld.length, " ", "\u6761\u7ED3\u8BBA\u672A\u901A\u8FC7\u6821\u9A8C\u3002\u5F15\u7528\u7684\u5185\u5BB9\u4E0E\u539F\u6587\u5BF9\u4E0D\u4E0A\uFF0C\u6CA1\u6709\u5C55\u793A\uFF1B\u53EF\u91CD\u65B0\u5BA1\u67E5\u3002")), /* @__PURE__ */ import_react3.default.createElement("section", { id: "overview-coverage" }, /* @__PURE__ */ import_react3.default.createElement("h2", null, "\u5BA1\u67E5\u8986\u76D6 ", /* @__PURE__ */ import_react3.default.createElement("small", { className: "el-basis" }, "\u4EE3\u7801\u4E8B\u5B9E")), covList("\u5DF2\u5BA1", coverage?.reviewed), covList(
    "\u5F85\u5BA1",
    (record.reviewablePaths || []).filter(
      (path) => !coverage?.reviewed.includes(path) && !coverage?.failed.some(
        (f) => (typeof f === "string" ? f : f.path) === path
      )
    )
  ), covList(
    "\u8DF3\u8FC7",
    coverage?.skipped || record.snapshot.files.filter((f) => !(record.reviewablePaths || []).includes(f.path)).map((f) => ({
      path: f.path,
      reason: f.note || (f.change === "mode-changed" ? "\u4EC5\u6743\u9650\u53D8\u5316" : f.change === "renamed" && f.baseSha256 === f.headSha256 ? "\u4EC5\u91CD\u547D\u540D" : {
        text: "",
        binary: "\u4E8C\u8FDB\u5236\u6587\u4EF6",
        oversize: "\u8D85\u8FC7\u5927\u5C0F\u4E0A\u9650",
        excluded: "\u6309\u89C4\u5219\u6392\u9664",
        submodule: "\u5B50\u6A21\u5757",
        conflicted: "\u5B58\u5728\u51B2\u7A81"
      }[f.kind] || "\u4E0D\u53EF\u5BA1\u67E5\u6587\u4EF6")
    }))
  ), covList("\u5931\u8D25", coverage?.failed)), /* @__PURE__ */ import_react3.default.createElement("details", { id: "overview-requirements", className: "overview-requirements" }, /* @__PURE__ */ import_react3.default.createElement("summary", null, "\u9700\u6C42\u4F9D\u636E"), /* @__PURE__ */ import_react3.default.createElement("p", null, record.delivery.externalRef ? "\u9700\u6C42\u7F16\u53F7\uFF1A" + record.delivery.externalRef : "\u672A\u586B\u5199\u9700\u6C42\u7F16\u53F7"), requirements.length ? requirements.map((s) => /* @__PURE__ */ import_react3.default.createElement("article", { key: s.reqId }, /* @__PURE__ */ import_react3.default.createElement("h3", null, s.origin || s.kind, " \xB7 ", localTime(s.capturedAt)), s.items.map((i) => /* @__PURE__ */ import_react3.default.createElement("div", { id: "req-" + i.itemId, key: i.itemId }, /* @__PURE__ */ import_react3.default.createElement(
    Prose,
    {
      text: Array.from(s.text).slice(i.start, i.end).join("")
    }
  ))))) : /* @__PURE__ */ import_react3.default.createElement("p", null, "\u672A\u63D0\u4F9B\u9700\u6C42\u4F9D\u636E\u3002"), !record.readOnly && /* @__PURE__ */ import_react3.default.createElement("button", { className: "el-btn", onClick: () => setAdding(true) }, "\u6DFB\u52A0\u9700\u6C42\u4F9D\u636E")), adding && /* @__PURE__ */ import_react3.default.createElement(
    RequirementDialog,
    {
      runtime,
      record,
      close: () => setAdding(false)
    }
  ));
}
function RequirementDialog({
  runtime,
  record,
  close
}) {
  const [text, setText] = import_react3.default.useState(""), [kind, setKind] = import_react3.default.useState("paste"), [origin, setOrigin] = import_react3.default.useState("\u7C98\u8D34\u6587\u5B57"), [externalRef, setExternalRef] = import_react3.default.useState(
    record.delivery.externalRef || ""
  ), [error, setError] = import_react3.default.useState(""), [saving, setSaving] = import_react3.default.useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await runtime.run(
        "capture",
        {
          workspaceId: runtime.workspaceId(),
          deliveryId: record.delivery.deliveryId,
          snapshotId: record.snapshot.snapshotId,
          externalRef,
          requirement: { id: crypto.randomUUID(), kind, origin, text }
        },
        { view: "overview" }
      );
      runtime.update({ notice: "\u9700\u6C42\u4F9D\u636E\u5DF2\u66F4\u65B0\uFF0C\u5BA1\u67E5\u5168\u90E8\u540E\u66F4\u65B0\u5BF9\u9F50\u5224\u65AD\u3002" });
      close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return /* @__PURE__ */ import_react3.default.createElement(Dialog, { title: "\u6DFB\u52A0\u9700\u6C42\u4F9D\u636E", close }, /* @__PURE__ */ import_react3.default.createElement("label", null, "\u9700\u6C42\u7F16\u53F7", /* @__PURE__ */ import_react3.default.createElement(
    "input",
    {
      value: externalRef,
      onChange: (e) => setExternalRef(e.target.value)
    }
  )), /* @__PURE__ */ import_react3.default.createElement("label", { className: "el-file-button" }, "\u9009\u62E9\u6587\u4EF6", /* @__PURE__ */ import_react3.default.createElement(
    "input",
    {
      type: "file",
      accept: ".md,.txt,text/plain,text/markdown",
      onChange: async (e) => {
        const f = e.target.files?.[0];
        if (f) {
          setText((await f.text()).replace(/\r\n?/g, "\n"));
          setKind("file");
          setOrigin(f.name);
        }
      }
    }
  )), /* @__PURE__ */ import_react3.default.createElement(
    "textarea",
    {
      "aria-label": "\u9700\u6C42\u539F\u6587",
      placeholder: "\u7C98\u8D34\u5B8C\u6574\u9700\u6C42\u6587\u5B57",
      value: text,
      onChange: (e) => {
        setText(e.target.value.replace(/\r\n?/g, "\n"));
        setKind("paste");
        setOrigin("\u7C98\u8D34\u6587\u5B57");
      }
    }
  ), /* @__PURE__ */ import_react3.default.createElement("p", null, "\u4F1A\u751F\u6210\u4E00\u6761\u65B0\u7684\u5F85\u5BA1\u8BB0\u5F55\uFF0C\u4E0D\u81EA\u52A8\u8C03\u7528\u6A21\u578B\u3002"), error && /* @__PURE__ */ import_react3.default.createElement("p", { role: "alert", className: "el-error" }, error), /* @__PURE__ */ import_react3.default.createElement("footer", null, /* @__PURE__ */ import_react3.default.createElement("button", { className: "el-btn", onClick: close }, "\u53D6\u6D88"), /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      className: "el-btn",
      onClick: save,
      disabled: !text.trim() || saving
    },
    saving ? "\u6B63\u5728\u51BB\u7ED3" : "\u6DFB\u52A0"
  )));
}

// plugin/client/diff.tsx
var import_react4 = __toESM(require("react"), 1);
var import_react_dom2 = require("react-dom");
var category = {
  logic: "\u903B\u8F91",
  security: "\u5B89\u5168",
  performance: "\u6027\u80FD",
  user_experience: "\u4F53\u9A8C",
  ux: "\u4F53\u9A8C"
};
var vendorPromise;
function loadVendor() {
  if (window.Diff2HtmlUI) return Promise.resolve();
  return vendorPromise ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/api/dsh-evidentloop/assets/diff.js";
    script.onload = () => window.Diff2HtmlUI ? resolve() : reject(Error("Diff\u7EC4\u4EF6\u672A\u52A0\u8F7D"));
    script.onerror = () => {
      vendorPromise = null;
      reject(Error("\u65E0\u6CD5\u52A0\u8F7D\u672C\u5730Diff\u7EC4\u4EF6"));
    };
    document.head.append(script);
  });
}
function useDark() {
  const [dark, setDark] = (0, import_react4.useState)(
    document.body.hasAttribute("data-ds-dark-theme")
  );
  (0, import_react4.useEffect)(() => {
    const o = new MutationObserver(
      () => setDark(document.body.hasAttribute("data-ds-dark-theme"))
    );
    o.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-ds-dark-theme"]
    });
    return () => o.disconnect();
  }, []);
  return dark;
}
function IssueCard({
  issue,
  suppressed,
  readOnly,
  editorOpen,
  onComment,
  onMark,
  onAsk,
  next,
  count,
  children
}) {
  const [collapsed, setCollapsed] = (0, import_react4.useState)(suppressed), [copied, setCopied] = (0, import_react4.useState)(false), [suggestionCollapsed, setSuggestionCollapsed] = (0, import_react4.useState)(false);
  (0, import_react4.useEffect)(() => setCollapsed(suppressed), [suppressed]);
  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(issue.suggestion?.code || "");
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return /* @__PURE__ */ import_react4.default.createElement(
    "article",
    {
      className: "el-issue-card " + (suppressed ? "el-suppressed" : ""),
      "data-finding-id": issue.findingId,
      "data-severity": issue.severity
    },
    /* @__PURE__ */ import_react4.default.createElement("header", null, /* @__PURE__ */ import_react4.default.createElement(
      "button",
      {
        className: "el-issue-toggle",
        "aria-expanded": !collapsed,
        onClick: () => setCollapsed(!collapsed)
      },
      /* @__PURE__ */ import_react4.default.createElement(Icon, { name: collapsed ? "down" : "up" }),
      /* @__PURE__ */ import_react4.default.createElement("span", { className: "el-category" }, category[issue.category] || issue.category),
      /* @__PURE__ */ import_react4.default.createElement("span", { className: "el-severity" }, issue.severity, " \xB7", " ", issue.severity === "P0" ? "\u963B\u65AD" : issue.severity === "P1" ? "\u4E25\u91CD" : "\u4E00\u822C"),
      /* @__PURE__ */ import_react4.default.createElement("strong", null, issue.title),
      suppressed && /* @__PURE__ */ import_react4.default.createElement("small", null, "\u5DF2\u6807\u8BB0\u975E\u95EE\u9898")
    ), /* @__PURE__ */ import_react4.default.createElement("div", { className: "el-issue-actions" }, !readOnly && /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null, !suppressed && /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null, /* @__PURE__ */ import_react4.default.createElement(
      IconButton,
      {
        label: editorOpen ? "\u6536\u8D77\u6279\u6CE8\uFF08\u4FDD\u7559\u8349\u7A3F\uFF09" : "\u6DFB\u52A0\u6279\u6CE8",
        icon: "comment",
        className: "el-icon-button issue-card-comment",
        "data-entry": "finding-" + issue.findingId,
        "aria-expanded": editorOpen,
        disabled: readOnly,
        onClick: (e) => {
          e.stopPropagation();
          setCollapsed(false);
          onComment();
        }
      }
    ), /* @__PURE__ */ import_react4.default.createElement(
      IconButton,
      {
        label: "\u5728\u4F1A\u8BDD\u4E2D\u8FFD\u95EE\u6B64\u4EE3\u7801\u6BB5",
        icon: "ask",
        className: "issue-card-ask",
        disabled: readOnly,
        onClick: (e) => {
          e.stopPropagation();
          onAsk();
        }
      }
    )), suppressed ? /* @__PURE__ */ import_react4.default.createElement(
      "button",
      {
        className: "el-restore-link",
        "aria-label": "\u6062\u590D\u4E3A\u6709\u6548\u95EE\u9898",
        disabled: readOnly,
        onClick: (e) => {
          e.stopPropagation();
          onMark(false, e.currentTarget);
        }
      },
      "\u6062\u590D"
    ) : /* @__PURE__ */ import_react4.default.createElement(
      IconButton,
      {
        label: "\u6807\u8BB0\u975E\u95EE\u9898",
        icon: "minus",
        className: "issue-card-suppress",
        disabled: readOnly,
        onClick: (e) => {
          e.stopPropagation();
          onMark(true, e.currentTarget);
        }
      }
    )), count > 1 && !suppressed && /* @__PURE__ */ import_react4.default.createElement(
      IconButton,
      {
        label: "\u4E0B\u4E00\u4E2A\u95EE\u9898",
        icon: "next",
        className: "el-icon-button el-next-issue",
        onClick: (e) => {
          e.stopPropagation();
          next();
        }
      }
    ))),
    !collapsed && /* @__PURE__ */ import_react4.default.createElement("div", { className: "el-issue-content" }, /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("strong", null, "\u95EE\u9898\uFF1A"), /* @__PURE__ */ import_react4.default.createElement(Prose, { text: issue.problem })), /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("strong", null, "\u5F71\u54CD\uFF1A"), /* @__PURE__ */ import_react4.default.createElement(Prose, { text: issue.impact })), issue.suggestion && /* @__PURE__ */ import_react4.default.createElement(
      "section",
      {
        className: "el-suggestion" + (issue.suggestion.code ? " el-suggestion--code" : ""),
        "aria-label": "\u4FEE\u6539\u5EFA\u8BAE"
      },
      issue.suggestion.code ? /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "el-suggestion-head" }, /* @__PURE__ */ import_react4.default.createElement(
        "button",
        {
          className: "el-suggestion-toggle",
          "aria-expanded": !suggestionCollapsed,
          onClick: (e) => {
            e.stopPropagation();
            setSuggestionCollapsed(!suggestionCollapsed);
          }
        },
        /* @__PURE__ */ import_react4.default.createElement(Icon, { name: suggestionCollapsed ? "down" : "up" }),
        "\u4FEE\u6539\u5EFA\u8BAE"
      ), /* @__PURE__ */ import_react4.default.createElement("div", { className: "el-code-actions" }, /* @__PURE__ */ import_react4.default.createElement("button", { className: "el-btn", onClick: copy }, copied ? "\u5DF2\u590D\u5236" : "\u590D\u5236\u5EFA\u8BAE"))), !suggestionCollapsed && /* @__PURE__ */ import_react4.default.createElement("div", { className: "el-suggestion-body" }, /* @__PURE__ */ import_react4.default.createElement(Prose, { text: issue.suggestion.text }), /* @__PURE__ */ import_react4.default.createElement("pre", null, /* @__PURE__ */ import_react4.default.createElement("code", null, issue.suggestion.code)))) : /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null, /* @__PURE__ */ import_react4.default.createElement("strong", null, "\u4FEE\u6539\u5EFA\u8BAE"), /* @__PURE__ */ import_react4.default.createElement(Prose, { text: issue.suggestion.text }))
    )),
    children
  );
}
function AnnotationEditor({
  runtime,
  record,
  editor,
  close,
  saved
}) {
  const ref = (0, import_react4.useRef)(null), composing = (0, import_react4.useRef)(false), [text, setText] = (0, import_react4.useState)(
    runtime.annotationDrafts.get(editor.key) ?? editor.text ?? ""
  ), [error, setError] = (0, import_react4.useState)(""), [saving, setSaving] = (0, import_react4.useState)(false), count = Array.from(text).length;
  (0, import_react4.useEffect)(() => {
    ref.current?.focus();
    ref.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, []);
  const change = (value) => {
    const text2 = value.replace(/\r\n?/g, "\n");
    setText(text2);
    runtime.annotationDrafts.set(editor.key, text2);
  };
  const save = async () => {
    if (composing.current || !text.trim() || count > 2e3 || saving) return;
    setSaving(true);
    try {
      await runtime.api("annotation", {
        workspaceId: runtime.workspaceId(),
        deliveryId: record.delivery.deliveryId,
        snapshotId: record.snapshot.snapshotId,
        annotationId: editor.annotationId,
        findingId: editor.findingId,
        anchor: editor.anchor,
        text
      });
      runtime.annotationDrafts.delete(editor.key);
      await saved();
      close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return /* @__PURE__ */ import_react4.default.createElement("section", { className: "annotation-editor annotation-editor--inline" }, /* @__PURE__ */ import_react4.default.createElement("h4", null, "\u6279\u6CE8 \xB7", " ", editor.anchor.startLine === null ? "\u6587\u4EF6\u7EA7" : (editor.anchor.side === "base" ? "\u65E7\u4EE3\u7801" : "\u65B0\u4EE3\u7801") + "\u7B2C " + editor.anchor.startLine + " \u884C"), /* @__PURE__ */ import_react4.default.createElement(
    "textarea",
    {
      ref,
      className: "annotation-editor__input",
      "aria-label": "\u6279\u6CE8\u5185\u5BB9",
      value: text,
      onChange: (e) => change(e.target.value),
      onCompositionStart: () => {
        composing.current = true;
      },
      onCompositionEnd: () => {
        composing.current = false;
      },
      onKeyDown: (e) => {
        if (composing.current || e.nativeEvent.isComposing) return;
        if (e.key === "Escape") {
          e.stopPropagation();
          e.preventDefault();
          close();
        }
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          save();
        }
      },
      placeholder: "\u5199\u4E0B\u4FEE\u6539\u8981\u6C42\u6216\u610F\u89C1\u2026"
    }
  ), /* @__PURE__ */ import_react4.default.createElement("p", { className: "annotation-editor__error", role: "alert" }, error || (count > 2e3 ? "\u6279\u6CE8\u6700\u591A2000\u5B57" : "")), /* @__PURE__ */ import_react4.default.createElement("div", { className: "annotation-editor__actions" }, /* @__PURE__ */ import_react4.default.createElement("small", null, count, " / 2000 \xB7 \u2318 / Ctrl+Enter \u4FDD\u5B58 \xB7 Esc\u6536\u8D77\u5E76\u4FDD\u7559\u8349\u7A3F"), /* @__PURE__ */ import_react4.default.createElement("button", { className: "el-btn", onClick: close }, "\u6536\u8D77"), /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      className: "el-primary",
      disabled: saving || !text.trim() || count > 2e3,
      onClick: save
    },
    saving ? "\u6B63\u5728\u4FDD\u5B58" : "\u4FDD\u5B58\u6279\u6CE8"
  )));
}
function AnnotationCard({
  annotation,
  readOnly,
  editorOpen,
  edit,
  remove
}) {
  const [copied, setCopied] = (0, import_react4.useState)(false);
  return /* @__PURE__ */ import_react4.default.createElement(
    "article",
    {
      className: "el-annotation-card",
      "data-annotation-id": annotation.annotationId
    },
    /* @__PURE__ */ import_react4.default.createElement("header", null, /* @__PURE__ */ import_react4.default.createElement("strong", null, "\u6279\u6CE8"), /* @__PURE__ */ import_react4.default.createElement("small", null, localTime(annotation.updatedAt)), /* @__PURE__ */ import_react4.default.createElement("span", { className: "el-header-spacer" }), /* @__PURE__ */ import_react4.default.createElement(
      "button",
      {
        className: "el-btn",
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(annotation.text);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }
      },
      copied ? "\u5DF2\u590D\u5236" : "\u590D\u5236"
    ), !readOnly && /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null, /* @__PURE__ */ import_react4.default.createElement(
      "button",
      {
        className: "el-btn",
        "data-action": "edit",
        "data-entry": "annotation-" + annotation.annotationId,
        "aria-expanded": editorOpen,
        "aria-label": editorOpen ? "\u6536\u8D77\u6279\u6CE8\uFF08\u4FDD\u7559\u8349\u7A3F\uFF09" : "\u7F16\u8F91\u6279\u6CE8",
        title: editorOpen ? "\u6536\u8D77\u6279\u6CE8\uFF08\u4FDD\u7559\u8349\u7A3F\uFF09" : "\u7F16\u8F91\u6279\u6CE8",
        onClick: edit
      },
      editorOpen ? "\u6536\u8D77" : "\u7F16\u8F91"
    ), /* @__PURE__ */ import_react4.default.createElement("button", { className: "el-btn", onClick: remove }, "\u5220\u9664"))),
    /* @__PURE__ */ import_react4.default.createElement(Prose, { text: annotation.text })
  );
}
function Diff({
  runtime,
  record,
  path,
  sideBySide,
  anchor,
  showExplanation,
  onToggleExplanation,
  onFile
}) {
  const firstIssue = (0, import_react4.useRef)(), root = (0, import_react4.useRef)(null), lineRows = (0, import_react4.useRef)([]), pendingFocus = (0, import_react4.useRef)(), dark = useDark(), [data, setData] = (0, import_react4.useState)(null), [error, setError] = (0, import_react4.useState)(""), [places, setPlaces] = (0, import_react4.useState)([]), [drawn, setDrawn] = (0, import_react4.useState)(false), [referenceContext, setReferenceContext] = (0, import_react4.useState)(null), [editor, setEditor] = (0, import_react4.useState)(null), [undo, setUndo] = (0, import_react4.useState)(null), [markPrompt, setMarkPrompt] = (0, import_react4.useState)(null), [suppressedOpen, setSuppressedOpen] = (0, import_react4.useState)(/* @__PURE__ */ new Set()), markFocus = (0, import_react4.useRef)(null), undoTimer = (0, import_react4.useRef)();
  const all = record.snapshot.files, file = all.find((f) => f.path === path), issues = (record.run?.findings || []).filter(
    (f) => f.anchor.path === path || f.anchor.path === file?.oldPath
  ), marks = new Set(
    record.marks.filter((m) => m.suppressed).map((m) => m.findingId)
  ), annotations = record.annotations.filter((a) => a.anchor.path === path), active = issues.filter((f) => !marks.has(f.findingId));
  const suppressedIssues = issues.filter((f) => marks.has(f.findingId)), visibleIssue = (issue) => !marks.has(issue.findingId) || suppressedOpen.has(issue.findingId);
  const toggleSuppressed = (ids) => setSuppressedOpen((old) => {
    const next = new Set(old), open = ids.every((id) => old.has(id));
    for (const id of ids) open ? next.delete(id) : next.add(id);
    return next;
  });
  (0, import_react4.useEffect)(() => {
    setSuppressedOpen(/* @__PURE__ */ new Set());
    setMarkPrompt(null);
  }, [path, record.snapshot.snapshotId]);
  (0, import_react4.useEffect)(() => {
    const restoreFocus = () => {
      const next = markFocus.current;
      if (!next || !drawn) return;
      const selector = next.suppressed ? '.el-suppressed-marker[data-mark-finding-id="' + CSS.escape(next.id) + '"]' : '[data-finding-id="' + CSS.escape(next.id) + '"] button[aria-label="\u6807\u8BB0\u975E\u95EE\u9898"]';
      const entry = document.querySelector(selector) || next.suppressed && document.querySelector(
        '[data-finding-id="' + CSS.escape(next.id) + '"] button[aria-label="\u6062\u590D\u4E3A\u6709\u6548\u95EE\u9898"]'
      );
      if (entry) {
        entry.focus({ preventScroll: true });
        if (document.activeElement === entry) markFocus.current = null;
      }
    };
    restoreFocus();
    window.addEventListener("focus", restoreFocus);
    document.addEventListener("visibilitychange", restoreFocus);
    return () => {
      window.removeEventListener("focus", restoreFocus);
      document.removeEventListener("visibilitychange", restoreFocus);
    };
  }, [record.marks, places, drawn]);
  const args = () => ({
    workspaceId: runtime.workspaceId(),
    deliveryId: record.delivery.deliveryId,
    snapshotId: record.snapshot.snapshotId
  });
  (0, import_react4.useEffect)(() => {
    let current = true;
    setData(null);
    setPlaces([]);
    setError("");
    if (path)
      runtime.api(`file?${new URLSearchParams({ ...args(), path })}`).then((d) => {
        if (current) setData(d);
      }).catch((e) => {
        if (current) setError(errorMessage(e));
      });
    return () => {
      current = false;
    };
  }, [path, record.snapshot.snapshotId]);
  const anchorOf = (side, line) => {
    if (!file) throw Error("\u51BB\u7ED3\u6587\u4EF6\u4E0D\u5B58\u5728");
    return {
      path: file.path,
      side,
      startLine: line,
      endLine: line,
      sha256: side === "base" ? file.baseSha256 : file.headSha256
    };
  };
  const closeEditor = () => {
    pendingFocus.current = editor?.entry;
    setEditor(null);
  };
  (0, import_react4.useEffect)(() => {
    if (editor || !pendingFocus.current) return;
    const entry = document.querySelector(
      '[data-entry="' + CSS.escape(pendingFocus.current) + '"]'
    );
    if (entry) {
      entry.focus();
      pendingFocus.current = void 0;
    }
  }, [editor, places]);
  const openEditor = (value) => {
    const key = record.snapshot.snapshotId + ":" + (value.annotationId || value.findingId || value.anchor.side + ":" + value.anchor.startLine);
    if (editor?.key === key) closeEditor();
    else setEditor({ ...value, key });
  };
  const mark = (issue, suppressed) => runtime.perform(async () => {
    await runtime.api("mark", {
      ...args(),
      findingId: issue.findingId,
      suppressed
    });
    markFocus.current = { id: issue.findingId, suppressed };
    if (suppressed && editor?.findingId === issue.findingId) setEditor(null);
    setMarkPrompt(null);
    await runtime.reloadRecord();
  });
  const remove = (annotation) => runtime.perform(async () => {
    await runtime.api("annotation", {
      ...args(),
      annotationId: annotation.annotationId,
      remove: true
    });
    setUndo(annotation);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6e3);
    await runtime.reloadRecord();
  });
  (0, import_react4.useEffect)(() => () => clearTimeout(undoTimer.current), []);
  (0, import_react4.useEffect)(() => {
    if (!data || !root.current) return;
    let live = true;
    const created = [], observers = [];
    setDrawn(false);
    lineRows.current = [];
    loadVendor().then(() => {
      if (!live) return;
      const el = root.current;
      el.replaceChildren();
      if (data.patch) {
        const viewer = new window.Diff2HtmlUI(el, data.patch, {
          drawFileList: false,
          outputFormat: sideBySide ? "side-by-side" : "line-by-line",
          matching: "lines",
          highlight: true,
          renderNothingWhenEmpty: true,
          highlightLanguages: [],
          colorScheme: document.body.hasAttribute("data-ds-dark-theme") ? "dark" : "light",
          synchronisedScroll: false,
          fileContentToggle: false
        });
        viewer.draw();
        viewer.highlightCode();
      }
      const slots = [], rows = [...el.querySelectorAll("tr")];
      for (const row of rows) {
        const sideRoot = row.closest(".d2h-file-side-diff"), sides = [...el.querySelectorAll(".d2h-file-side-diff")], side = sideRoot ? sides.indexOf(sideRoot) === 0 ? "base" : "head" : null;
        if (side) {
          const n = Number(
            row.querySelector(".d2h-code-side-linenumber")?.textContent?.trim()
          );
          if (Number.isInteger(n) && n > 0)
            slots.push({ row, side, line: n });
        } else {
          for (const [selector, s] of [
            [".line-num1", "base"],
            [".line-num2", "head"]
          ]) {
            const n = Number(
              row.querySelector(selector)?.textContent?.trim()
            );
            if (Number.isInteger(n) && n > 0)
              slots.push({ row, side: s, line: n });
          }
        }
      }
      const tables = [
        ...el.querySelectorAll(".d2h-file-side-diff tbody")
      ], paired = tables.length === 2 ? tables.map((t) => [
        ...t.querySelectorAll(":scope > tr")
      ]) : [];
      const groups = /* @__PURE__ */ new Map();
      if (paired.length) {
        let lastWidth = -1;
        const align = () => {
          const width = el.clientWidth;
          if (width === lastWidth) return;
          lastWidth = width;
          for (let i = 0; i < paired[0].length; i++) {
            const a = paired[0][i], b = paired[1][i];
            if (!b) continue;
            a.style.height = b.style.height = "";
            const height = Math.max(
              a.getBoundingClientRect().height,
              b.getBoundingClientRect().height
            );
            a.style.height = b.style.height = height + "px";
          }
        };
        const observer = new ResizeObserver(align);
        observer.observe(el);
        observers.push(observer);
        align();
      }
      const point = (side, line) => {
        const found = slots.find((s) => s.side === side && s.line === line);
        if (!found) return null;
        let p = groups.get(found.row);
        if (p) return p;
        const tr = document.createElement("tr"), td = document.createElement("td"), container = document.createElement("div");
        tr.className = "el-diff-insert";
        td.colSpan = found.row.children.length;
        td.append(container);
        tr.append(td);
        found.row.after(tr);
        created.push(tr);
        p = {
          ...found,
          container,
          locations: slots.filter((s) => s.row === found.row).map((s) => ({ side: s.side, line: s.line })),
          key: side + ":" + line
        };
        groups.set(found.row, p);
        return p;
      };
      for (const issue of issues)
        if (issue.anchor.line !== null && visibleIssue(issue))
          point(issue.anchor.side, issue.anchor.line);
      for (const issue of suppressedIssues) {
        const found = slots.find(
          (row) => row.side === issue.anchor.side && row.line === issue.anchor.line
        );
        if (!found) continue;
        const cell = found.row.querySelector(
          sideBySide ? ".d2h-code-side-linenumber" : ".d2h-code-linenumber"
        );
        if (!cell) continue;
        let span = cell.querySelector(".el-suppressed-slot");
        if (!span) {
          span = document.createElement("span");
          span.className = "el-suppressed-slot";
          cell.append(span);
          created.push(span);
        }
        pMarked.push({
          container: span,
          key: "suppressed:" + issue.findingId,
          markedIssue: issue
        });
      }
      for (const annotation of annotations)
        if (annotation.anchor.startLine !== null)
          point(annotation.anchor.side, annotation.anchor.startLine);
      if (editor && editor.anchor.path === path && editor.anchor.startLine !== null)
        point(editor.anchor.side, editor.anchor.startLine);
      if (!record.readOnly) {
        const seenRows = /* @__PURE__ */ new Set();
        for (const s of slots.filter(
          (s2) => sideBySide || s2.side === "head" || !slots.some(
            (other) => other.row === s2.row && other.side === "head"
          )
        )) {
          if (seenRows.has(s.row)) continue;
          seenRows.add(s.row);
          const cell = s.row.querySelector(
            sideBySide ? ".d2h-code-side-linenumber" : ".d2h-code-linenumber"
          );
          if (!cell) continue;
          const span = document.createElement("span");
          span.className = "el-line-add-slot";
          cell.append(span);
          created.push(span);
          pAdd.push({
            container: span,
            key: "line:" + s.side + ":" + s.line,
            side: s.side,
            line: s.line,
            action: () => runtime.perform(
              () => runtime.api("quote", {
                ...args(),
                path,
                side: s.side,
                line: s.line
              }).then(async (result) => {
                runtime.update({
                  notice: result.reason || (result.duplicate ? "\u8BE5\u4EE3\u7801\u6BB5\u5DF2\u5728\u8349\u7A3F\u4E2D\uFF0C\u672A\u91CD\u590D\u8FFD\u52A0\u3002" : "\u5DF2\u52A0\u5165\u5F00\u53D1\u4F1A\u8BDD\u8349\u7A3F\uFF0C\u672A\u53D1\u9001\u3002")
                });
                if (result.status === "written")
                  await runtime.native.openSession(result.targetId);
              })
            )
          });
        }
      }
      if (paired.length)
        for (const [row, p] of [...groups]) {
          const sideIndex = p.side === "base" ? 0 : 1, index2 = paired[sideIndex].indexOf(row), otherRow = paired[1 - sideIndex][index2];
          if (!otherRow) continue;
          let other = groups.get(otherRow);
          if (!other) {
            const tr = document.createElement("tr"), td = document.createElement("td"), container = document.createElement("div");
            tr.className = "el-diff-insert el-diff-spacer";
            td.colSpan = otherRow.children.length;
            td.append(container);
            tr.append(td);
            otherRow.after(tr);
            created.push(tr);
            other = { container };
          }
          const update = () => {
            const left = p.container.firstElementChild, right = other.container.firstElementChild, height = Math.max(
              left?.getBoundingClientRect().height || 0,
              right?.getBoundingClientRect().height || 0
            );
            p.container.style.minHeight = height + "px";
            other.container.style.minHeight = height + "px";
          };
          const o = new ResizeObserver(update);
          o.observe(p.container);
          o.observe(other.container);
          observers.push(o);
        }
      lineRows.current = slots;
      setPlaces([...groups.values(), ...pAdd, ...pMarked]);
      setDrawn(true);
    }).catch((e) => {
      if (live) setError(errorMessage(e));
    });
    const pAdd = [], pMarked = [];
    return () => {
      live = false;
      setPlaces([]);
      observers.forEach((o) => o.disconnect());
      created.forEach((e) => e.remove());
    };
  }, [
    data,
    sideBySide,
    editor?.key,
    issues.map((i) => i.findingId).join(","),
    annotations.map((a) => a.annotationId).join(","),
    record.readOnly,
    dark,
    [...marks].join(","),
    [...suppressedOpen].join(",")
  ]);
  const renderIssue = (issue) => /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, { key: issue.findingId }, /* @__PURE__ */ import_react4.default.createElement(
    IssueCard,
    {
      issue,
      suppressed: marks.has(issue.findingId),
      readOnly: record.readOnly,
      editorOpen: editor?.findingId === issue.findingId && !editor.annotationId,
      onComment: () => openEditor({
        findingId: issue.findingId,
        anchor: anchorOf(issue.anchor.side, issue.anchor.line),
        entry: "finding-" + issue.findingId
      }),
      onMark: (suppressed, entry) => setMarkPrompt({ issue, suppressed, entry }),
      onAsk: () => runtime.perform(
        () => runtime.api("quote", { ...args(), findingId: issue.findingId }).then(async (result) => {
          runtime.update({
            notice: result.status === "written" ? "\u5DF2\u52A0\u5165\u5F00\u53D1\u4F1A\u8BDD\u8349\u7A3F\uFF0C\u672A\u53D1\u9001\u3002" : result.reason || result.status
          });
          if (result.status === "written")
            await runtime.native.openSession(result.targetId);
        })
      ),
      count: active.length,
      next: () => {
        const n = active[(active.findIndex((f) => f.findingId === issue.findingId) + 1) % active.length];
        document.querySelector(
          '[data-finding-id="' + CSS.escape(n.findingId) + '"]'
        )?.scrollIntoView({ block: "center" });
        pulse(n.findingId);
        document.querySelector(
          '[data-finding-id="' + CSS.escape(n.findingId) + '"] .el-next-issue'
        )?.focus({ preventScroll: true });
      }
    },
    !marks.has(issue.findingId) && editor?.findingId === issue.findingId && !editor.annotationId && /* @__PURE__ */ import_react4.default.createElement(
      AnnotationEditor,
      {
        key: editor.key,
        runtime,
        record,
        editor,
        close: closeEditor,
        saved: async () => {
          await runtime.reloadRecord();
          runtime.update({ notice: "\u5DF2\u4FDD\u5B58\uFF0C\u53D1\u56DE\u4F1A\u8BDD\u65F6\u4E00\u5E76\u5E26\u5165\u3002" });
        }
      }
    )
  ));
  const renderAnnotation = (a) => /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, { key: a.annotationId }, /* @__PURE__ */ import_react4.default.createElement(
    AnnotationCard,
    {
      annotation: a,
      readOnly: record.readOnly,
      editorOpen: editor?.annotationId === a.annotationId,
      edit: () => openEditor({
        annotationId: a.annotationId,
        findingId: a.findingId,
        anchor: a.anchor,
        text: a.text,
        entry: "annotation-" + a.annotationId
      }),
      remove: () => remove(a)
    }
  ), editor?.annotationId === a.annotationId && /* @__PURE__ */ import_react4.default.createElement(
    AnnotationEditor,
    {
      key: editor.key,
      runtime,
      record,
      editor,
      close: closeEditor,
      saved: () => runtime.reloadRecord()
    }
  ));
  const matched = (item, place, line) => (place.locations || [place]).some(
    (p) => item.side === p.side && line === p.line
  );
  const placedIssue = (issue) => places.some(
    (p) => !p.action && !p.markedIssue && matched(issue.anchor, p, issue.anchor.line)
  );
  const placedAnnotation = (a) => places.some((p) => !p.action && matched(a.anchor, p, a.anchor.startLine));
  const fallbackIssues = drawn ? issues.filter(
    (i) => !placedIssue(i) && (!marks.has(i.findingId) || suppressedOpen.has(i.findingId) || !lineRows.current.some(
      (p) => p.side === i.anchor.side && p.line === i.anchor.line
    ))
  ) : [], fallbackAnnotations = drawn ? annotations.filter((a) => !placedAnnotation(a)) : [];
  (0, import_react4.useEffect)(() => {
    setReferenceContext(null);
    if (!anchor || !data || !drawn) return;
    const timer = setTimeout(() => {
      if (anchor.findingId) {
        const target = document.querySelector(
          '[data-finding-id="' + CSS.escape(anchor.findingId) + '"]'
        );
        target?.scrollIntoView({ block: "center" });
        pulse(anchor.findingId);
      } else if (anchor.line || anchor.startLine) {
        const line = anchor.line || anchor.startLine, side = anchor.side || "head", place = lineRows.current.find(
          (p) => p.side === side && p.line === line
        );
        if (place) place.row.scrollIntoView({ block: "center" });
        else setReferenceContext({ side, line });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [anchor, data, places, drawn]);
  (0, import_react4.useEffect)(() => {
    const key = record.snapshot.snapshotId + ":" + path + ":" + sideBySide;
    if (!drawn || anchor || !active.length || firstIssue.current === key)
      return;
    const timer = setTimeout(() => {
      const target = document.querySelector(
        '[data-finding-id="' + CSS.escape(active[0].findingId) + '"]'
      );
      if (target) {
        target.scrollIntoView({ block: "center" });
        pulse(active[0].findingId);
        firstIssue.current = key;
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [drawn, places, path, sideBySide, anchor]);
  const fileSemantic = record.run?.understanding?.files.find(
    (f) => f.path === path
  )?.semantic;
  const semanticPresent = Boolean(
    record.run?.coverage?.reviewed.includes(path || "") && fileSemantic?.items?.length
  ), index = all.findIndex((f) => f.path === path);
  return /* @__PURE__ */ import_react4.default.createElement("div", { className: "el-diff-pane" }, markPrompt && /* @__PURE__ */ import_react4.default.createElement(
    Confirm,
    {
      title: markPrompt.suppressed ? "\u786E\u8BA4\u6807\u8BB0\u4E3A\u975E\u95EE\u9898\uFF1F" : "\u786E\u8BA4\u6062\u590D\u4E3A\u6709\u6548\u95EE\u9898\uFF1F",
      anchor: markPrompt.entry,
      close: () => setMarkPrompt(null),
      confirm: markPrompt.suppressed ? "\u786E\u8BA4\u6807\u8BB0" : "\u6062\u590D",
      action: () => mark(markPrompt.issue, markPrompt.suppressed)
    },
    markPrompt.suppressed ? "\u6807\u8BB0\u4E3A\u975E\u95EE\u9898\u540E\uFF0C\u5C06\u4E0D\u8BA1\u5165\u5F85\u4FEE\u590D\u6E05\u5355\uFF0C\u53EF\u968F\u65F6\u5728\u6B64\u6062\u590D\u3002" : "\u6062\u590D\u540E\u5C06\u91CD\u65B0\u8BA1\u5165\u5F85\u4FEE\u590D\u6E05\u5355\u3002"
  ), /* @__PURE__ */ import_react4.default.createElement("header", { className: "el-file-heading" }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "el-change-badge" }, {
    added: "A",
    deleted: "D",
    renamed: "R",
    modified: "M",
    "mode-changed": "M"
  }[file?.change || "modified"] || "M"), file?.change === "deleted" ? /* @__PURE__ */ import_react4.default.createElement(
    "span",
    {
      className: "el-file-name el-path",
      title: "\u6587\u4EF6\u5DF2\u5220\u9664\uFF0C\u4EC5\u80FD\u9605\u8BFB\u51BB\u7ED3\u5185\u5BB9"
    },
    path
  ) : /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      className: "el-file-name el-path",
      "aria-label": "\u5728\u7F16\u8F91\u5668\u4E2D\u6253\u5F00",
      onClick: () => runtime.perform(
        () => runtime.api("open-file", { ...args(), path })
      )
    },
    /* @__PURE__ */ import_react4.default.createElement("span", null, path || "\u6CA1\u6709\u53EF\u663E\u793A\u7684\u6587\u4EF6")
  ), Number.isInteger(file?.additions) && /* @__PURE__ */ import_react4.default.createElement("span", { className: "el-file-stats" }, /* @__PURE__ */ import_react4.default.createElement("span", null, "+", file?.additions), /* @__PURE__ */ import_react4.default.createElement("span", null, "-", file?.deletions)), /* @__PURE__ */ import_react4.default.createElement("span", { className: "el-header-spacer" }), /* @__PURE__ */ import_react4.default.createElement(
    IconButton,
    {
      label: "\u4E0A\u4E00\u4E2A\u6587\u4EF6",
      icon: "chevronLeft",
      size: "sm",
      disabled: index <= 0,
      onClick: () => onFile({ path: all[index - 1]?.path })
    }
  ), /* @__PURE__ */ import_react4.default.createElement(
    IconButton,
    {
      label: "\u4E0B\u4E00\u4E2A\u6587\u4EF6",
      icon: "chevronRight",
      size: "sm",
      disabled: index >= all.length - 1,
      onClick: () => onFile({ path: all[index + 1]?.path })
    }
  ), semanticPresent ? /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      className: "el-btn",
      "aria-pressed": showExplanation,
      onClick: onToggleExplanation
    },
    showExplanation ? "\u6536\u8D77\u8BF4\u660E" : "\u67E5\u770B\u8BF4\u660E"
  ) : file && !record.readOnly && data?.reviewable && /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      className: "el-btn",
      disabled: !runtime.state.data.modelTestGate.approved || record.run?.status === "running",
      onClick: () => runtime.perform(
        () => runtime.run("review", { ...args(), scope: "file:" + path })
      )
    },
    record.run?.status === "running" ? "\u5BA1\u67E5\u4E2D\u2026" : "\u5BA1\u67E5\u672C\u6587\u4EF6"
  )), suppressedIssues.length > 0 && /* @__PURE__ */ import_react4.default.createElement("div", { className: "el-file-suppressed-bar" }, /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      className: "el-file-suppressed-chip",
      "aria-expanded": suppressedIssues.every(
        (i) => suppressedOpen.has(i.findingId)
      ),
      onClick: () => toggleSuppressed(suppressedIssues.map((i) => i.findingId))
    },
    /* @__PURE__ */ import_react4.default.createElement(Icon, { name: "minus", size: 13 }),
    "\u5DF2\u6807\u8BB0\u975E\u95EE\u9898 (",
    suppressedIssues.length,
    ")"
  )), error && /* @__PURE__ */ import_react4.default.createElement("p", { role: "alert", className: "el-error" }, error), !data && path && /* @__PURE__ */ import_react4.default.createElement("p", { className: "el-muted" }, "\u6B63\u5728\u8BFB\u53D6\u51BB\u7ED3\u4EE3\u7801\u2026"), data && !data.patch && /* @__PURE__ */ import_react4.default.createElement("div", { className: "el-empty" }, data.note || "\u672C\u6587\u4EF6\u6CA1\u6709\u53EF\u5448\u73B0\u7684\u6587\u672CDiff\uFF08\u53EF\u80FD\u4EC5\u6709\u5143\u6570\u636E\u53D8\u5316\uFF09\u3002"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "el-diff-scroll" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "el-file-fallback" }, referenceContext && /* @__PURE__ */ import_react4.default.createElement("section", null, /* @__PURE__ */ import_react4.default.createElement("p", null, "\u4EE3\u7801\u884C\u8D85\u51FA\u5F53\u524D Diff \u7247\u6BB5\uFF0C\u4EE5\u4E0B\u5448\u73B0\u672C\u6B21\u5BA1\u67E5\u8BB0\u5F55\u4E2D\u7684", referenceContext.side === "base" ? "\u65E7\u4EE3\u7801" : "\u65B0\u4EE3\u7801", "\u3002"), /* @__PURE__ */ import_react4.default.createElement(
    FrozenContext,
    {
      text: data?.[referenceContext.side],
      line: referenceContext.line
    }
  )), fallbackIssues.map((issue) => /* @__PURE__ */ import_react4.default.createElement("section", { key: issue.findingId }, /* @__PURE__ */ import_react4.default.createElement("p", { className: "el-muted" }, issue.anchor.line === null ? "\u6587\u4EF6\u7EA7\u95EE\u9898" : "\u4EE3\u7801\u884C\u8D85\u51FA\u5F53\u524D Diff \u7247\u6BB5\uFF0C\u4EE5\u4E0B\u5F15\u7528\u672C\u6B21\u5BA1\u67E5\u8BB0\u5F55\u4E2D\u7684" + (issue.anchor.side === "base" ? "\u65E7\u4EE3\u7801" : "\u65B0\u4EE3\u7801") + "\u3002"), issue.anchor.line !== null && data && /* @__PURE__ */ import_react4.default.createElement(
    FrozenContext,
    {
      text: data?.[issue.anchor.side],
      line: issue.anchor.line
    }
  ), renderIssue(issue))), fallbackAnnotations.map(renderAnnotation), drawn && editor && editor.anchor.path === path && !editor.findingId && !editor.annotationId && !places.some(
    (p) => !p.action && matched(editor.anchor, p, editor.anchor.startLine)
  ) && /* @__PURE__ */ import_react4.default.createElement(
    AnnotationEditor,
    {
      key: editor.key,
      runtime,
      record,
      editor,
      close: closeEditor,
      saved: () => runtime.reloadRecord()
    }
  )), /* @__PURE__ */ import_react4.default.createElement(
    "div",
    {
      ref: root,
      className: "el-diff-rendered " + (sideBySide ? "el-diff-split " : "el-diff-unified ") + (dark ? "d2h-dark-color-scheme" : "d2h-light-color-scheme")
    }
  )), places.map(
    (p) => p.markedIssue ? (0, import_react_dom2.createPortal)(
      /* @__PURE__ */ import_react4.default.createElement(
        "button",
        {
          type: "button",
          className: "el-suppressed-marker",
          "data-mark-finding-id": p.markedIssue.findingId,
          "aria-expanded": suppressedOpen.has(p.markedIssue.findingId),
          "aria-label": "\u5DF2\u6807\u8BB0\u975E\u95EE\u9898 \xB7 " + p.markedIssue.title + (suppressedOpen.has(p.markedIssue.findingId) ? " \xB7 \u6536\u8D77" : " \xB7 \u67E5\u770B\uFF0C\u53EF\u6062\u590D"),
          title: "\u5DF2\u6807\u8BB0\u975E\u95EE\u9898 \xB7 " + p.markedIssue.title,
          onClick: () => toggleSuppressed([p.markedIssue.findingId])
        },
        /* @__PURE__ */ import_react4.default.createElement(Icon, { name: "minus", size: 14 })
      ),
      p.container,
      p.key
    ) : p.action ? (0, import_react_dom2.createPortal)(
      /* @__PURE__ */ import_react4.default.createElement(
        "button",
        {
          className: "annotation-add-btn",
          "data-entry": "ask-" + p.side + "-" + p.line,
          title: "\u5728\u4F1A\u8BDD\u4E2D\u8FFD\u95EE\u6B64\u4EE3\u7801\u6BB5",
          "aria-label": "\u5728\u4F1A\u8BDD\u4E2D\u8FFD\u95EE\u6B64\u4EE3\u7801\u6BB5",
          onClick: p.action
        },
        /* @__PURE__ */ import_react4.default.createElement(Icon, { name: "ask", size: 14 })
      ),
      p.container,
      p.key
    ) : (0, import_react_dom2.createPortal)(
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "el-inline-stack" }, issues.filter(
        (i) => visibleIssue(i) && matched(i.anchor, p, i.anchor.line)
      ).map(renderIssue), annotations.filter((a) => matched(a.anchor, p, a.anchor.startLine)).map(renderAnnotation), editor && editor.anchor.path === path && !editor.findingId && !editor.annotationId && matched(editor.anchor, p, editor.anchor.startLine) && /* @__PURE__ */ import_react4.default.createElement(
        AnnotationEditor,
        {
          key: editor.key,
          runtime,
          record,
          editor,
          close: closeEditor,
          saved: () => runtime.reloadRecord()
        }
      )),
      p.container,
      p.key
    )
  ), showExplanation && semanticPresent && /* @__PURE__ */ import_react4.default.createElement("aside", { className: "el-file-explanation" }, /* @__PURE__ */ import_react4.default.createElement("h3", null, "\u53D8\u66F4\u6458\u8981"), fileSemantic?.items.length ? /* @__PURE__ */ import_react4.default.createElement("ul", null, fileSemantic.items.map((s, i) => /* @__PURE__ */ import_react4.default.createElement("li", { key: i }, /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      className: "el-summary-link",
      onClick: () => onFile(s.refs[0])
    },
    s.text
  )))) : /* @__PURE__ */ import_react4.default.createElement("p", null, "\u5C1A\u65E0\u901A\u8FC7\u6821\u9A8C\u7684\u6587\u4EF6\u8BF4\u660E\u3002"), /* @__PURE__ */ import_react4.default.createElement("h3", null, "\u4EE3\u7801\u8BC4\u5BA1"), /* @__PURE__ */ import_react4.default.createElement("ul", null, active.map((i) => /* @__PURE__ */ import_react4.default.createElement("li", { key: i.findingId }, /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      className: "el-summary-link",
      onClick: () => onFile({ ...i.anchor, findingId: i.findingId })
    },
    i.severity,
    " \xB7 ",
    i.title
  ))))), undo && /* @__PURE__ */ import_react4.default.createElement("div", { className: "el-undo", role: "status" }, "\u6279\u6CE8\u5DF2\u5220\u9664", " ", /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      className: "el-btn",
      onClick: () => runtime.perform(async () => {
        const original = undo;
        await runtime.api("annotation", {
          ...args(),
          annotationId: original.annotationId,
          anchor: original.anchor,
          findingId: original.findingId,
          text: original.text
        });
        setUndo(null);
        clearTimeout(undoTimer.current);
        await runtime.reloadRecord();
      })
    },
    "\u64A4\u9500"
  )));
}
function FrozenContext({ text, line }) {
  if (typeof text !== "string") return /* @__PURE__ */ import_react4.default.createElement("p", null, "\u8BE5\u4FA7\u65E0\u51BB\u7ED3\u6587\u672C\u3002");
  const lines = text.replace(/\r\n/g, "\n").split("\n"), start = Math.max(1, line - 2), end = Math.min(lines.length, line + 2);
  if (line < 1 || line > lines.length)
    return /* @__PURE__ */ import_react4.default.createElement("p", null, "\u8BE5\u4F4D\u7F6E\u6CA1\u6709\u53EF\u7528\u51BB\u7ED3\u884C\uFF0C\u4E0D\u751F\u6210\u66FF\u4EE3\u884C\u53F7\u3002");
  return /* @__PURE__ */ import_react4.default.createElement("pre", { className: "el-frozen-context" }, lines.slice(start - 1, end).map((s, i) => /* @__PURE__ */ import_react4.default.createElement("div", { key: i, "data-anchor": start + i === line || void 0 }, /* @__PURE__ */ import_react4.default.createElement("span", null, start + i), " ", s)));
}
function pulse(id) {
  const e = document.querySelector(
    '[data-finding-id="' + CSS.escape(id) + '"]'
  );
  if (!e) return;
  e.classList.remove("el-issue-pulse");
  void e.offsetWidth;
  e.classList.add("el-issue-pulse");
  setTimeout(() => e.classList.remove("el-issue-pulse"), 1600);
}

// plugin/client/review.tsx
function Review({
  runtime,
  state,
  openSettings
}) {
  const r = state.record, files = r.snapshot.files, [selected, setSelected] = (0, import_react5.useState)(
    () => r.run?.findings?.[0]?.anchor.path || files[0]?.path
  ), [tree, setTree] = (0, import_react5.useState)(true), [width, setWidth] = (0, import_react5.useState)(250), [query, setQuery] = (0, import_react5.useState)(""), [filter, setFilter] = (0, import_react5.useState)("all"), [preferredSplit, setPreferredSplit] = (0, import_react5.useState)(false), [addedSplitChoices, setAddedSplitChoices] = (0, import_react5.useState)({}), [explanation, setExplanation] = (0, import_react5.useState)(false), [anchor, setAnchor] = (0, import_react5.useState)(null), [draftTemplate, setDraftTemplate] = (0, import_react5.useState)(null);
  const bodyRef = (0, import_react5.useRef)(null), run = r.run, busy = ["running", "queued"].includes(run?.status || ""), active = (run?.findings || []).filter(
    (f) => !r.marks.some((m) => m.findingId === f.findingId && m.suppressed)
  ), risk = new Set(active.map((f) => f.anchor.path)), changed = /* @__PURE__ */ new Set([
    ...r.comparison?.added || [],
    ...r.comparison?.changed || []
  ]), gate = state.data.modelTestGate.approved;
  const reviewActionLabel = !run ? "\u5BA1\u67E5\u5168\u90E8" : run.status === "failed" ? "\u91CD\u8BD5" : run.status === "cancelled" ? "\u91CD\u65B0\u5BA1\u67E5" : run.complete ? null : (r.reviewablePaths || []).some(
    (p) => !run.coverage.reviewed.includes(p)
  ) ? "\u5BA1\u67E5\u5168\u90E8" : null;
  const selectedFile = files.find((f) => f.path === selected), addedLayout = selectedFile?.change === "added" || selectedFile?.baseLineCount === 0, layoutKey = r.snapshot.snapshotId + ":" + selected;
  const split = addedLayout ? Object.prototype.hasOwnProperty.call(addedSplitChoices, layoutKey) ? addedSplitChoices[layoutKey] : false : preferredSplit;
  const setSplit = (value) => {
    const next = Boolean(value);
    setPreferredSplit(next);
    if (addedLayout)
      setAddedSplitChoices((old) => ({ ...old, [layoutKey]: next }));
  };
  const args = () => ({
    workspaceId: runtime.workspaceId(),
    deliveryId: r.delivery.deliveryId,
    snapshotId: r.snapshot.snapshotId
  });
  (0, import_react5.useEffect)(() => {
    if (!files.some((f) => f.path === selected)) setSelected(files[0]?.path);
  }, [r.snapshot.snapshotId]);
  const jump = (ref) => {
    if (!ref?.path) return;
    const file = files.find(
      (f) => f.path === ref.path || f.oldPath === ref.path
    );
    if (!file) {
      runtime.update({ error: "\u8BE5\u5F15\u7528\u4E0D\u5C5E\u4E8E\u6240\u9009\u5BA1\u67E5\u8BB0\u5F55" });
      return;
    }
    setSelected(file.path);
    setAnchor({ ...ref, path: file.path, token: Date.now() });
    runtime.update({ view: "diff" });
  };
  const shown = files.filter(
    (f) => f.path.toLowerCase().includes(query.toLowerCase()) && (state.view === "overview" || filter === "all" || filter === "risk" && risk.has(f.path) || filter === "changed" && changed.has(f.path))
  );
  const review = (force = false) => runtime.perform(
    () => runtime.run("review", {
      ...args(),
      scope: force ? "all" : "incremental",
      force
    })
  );
  const sourceLabel = (range) => range.headSha === range.baseSha ? "\u672A\u63D0\u4EA4\u7684\u6539\u52A8" : "\u63D0\u4EA4\u300C" + (range.headSubject || "\u63D0\u4EA4") + "\u300D" + (range.dirty ? " + \u672A\u63D0\u4EA4\u6539\u52A8" : "");
  const startResize = (e) => {
    e.preventDefault();
    const start = e.clientX, original = width, max = Math.min(480, bodyRef.current.clientWidth * 0.45);
    const move = (ev) => setWidth(Math.max(180, Math.min(max, original + ev.clientX - start)));
    const end = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end, { once: true });
  };
  return /* @__PURE__ */ import_react5.default.createElement("section", { className: "el-review" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "el-review-heading" }, /* @__PURE__ */ import_react5.default.createElement("button", { className: "el-btn", onClick: () => runtime.back() }, /* @__PURE__ */ import_react5.default.createElement(Icon, { name: "back" }), "\u8FD4\u56DE"), /* @__PURE__ */ import_react5.default.createElement("div", { className: "el-review-title" }, /* @__PURE__ */ import_react5.default.createElement("h2", null, /* @__PURE__ */ import_react5.default.createElement(Clip, null, r.delivery.title)), /* @__PURE__ */ import_react5.default.createElement("p", null, /* @__PURE__ */ import_react5.default.createElement("span", { className: "el-path" }, r.delivery.branch || "\u5206\u652F\u4FE1\u606F\u4E0D\u53EF\u7528"), " ", "\xB7", " ", /* @__PURE__ */ import_react5.default.createElement(
    "span",
    {
      title: sourceLabel(r.snapshot.range) + " \xB7 " + (r.snapshot.range.baseSha || "").slice(0, 8)
    },
    r.delivery.branch === r.snapshot.range.targetRef?.replace(/^refs\/heads\//, "") ? "\u672A\u63D0\u4EA4\u7684\u6539\u52A8" : "\u76F8\u6BD4 " + (r.snapshot.range.targetRef || "\u76EE\u6807\u5206\u652F") + " \u7684\u6539\u52A8"
  ), " ", "\xB7", " ", /* @__PURE__ */ import_react5.default.createElement(
    Menu,
    {
      label: "\u5207\u6362\u5BA1\u67E5\u8BB0\u5F55\uFF08\u5171" + r.history.length + "\u6B21\uFF09",
      items: r.history.map((h, i) => ({
        label: localTime(h.createdAt) + (i === 0 ? " \xB7 \u6700\u65B0" : "") + " \xB7 " + h.statusText,
        note: sourceLabel(h.range),
        selected: h.snapshotId === r.snapshot.snapshotId,
        action: () => runtime.perform(
          () => runtime.open(
            r.delivery.deliveryId,
            state.view,
            h.snapshotId
          )
        )
      }))
    },
    "\u5BA1\u67E5\u8BB0\u5F55 \xB7 ",
    r.readOnly ? "" : "\u6700\u65B0 ",
    localTime(r.snapshot.createdAt)
  ))), /* @__PURE__ */ import_react5.default.createElement("span", { className: "el-header-spacer" })), r.readOnly && /* @__PURE__ */ import_react5.default.createElement("div", { className: "el-history-notice" }, "\u6B63\u5728\u67E5\u770B\u8F83\u65E9\u7684\u5BA1\u67E5\u8BB0\u5F55\uFF08\u53EA\u8BFB\uFF09\xB7", " ", /* @__PURE__ */ import_react5.default.createElement(
    Link,
    {
      onClick: () => runtime.perform(
        () => runtime.open(r.delivery.deliveryId, state.view)
      )
    },
    "\u6253\u5F00\u6700\u65B0\u5BA1\u67E5"
  )), r.run?.model?.adapter === "synthetic" && /* @__PURE__ */ import_react5.default.createElement("p", { className: "el-review-notice" }, "\u6D4B\u8BD5\u8BB0\u5F55\uFF1A\u672C\u8BB0\u5F55\u7531\u6D4B\u8BD5\u6837\u4F8B\u751F\u6210\uFF0C\u672A\u8C03\u7528\u771F\u5B9E AI \u6A21\u578B\u3002"), r.run?.model?.adapter === "dsh" && r.run.model.provider && /* @__PURE__ */ import_react5.default.createElement("p", { className: "el-review-notice" }, "\u771F\u5B9E\u6A21\u578B \xB7 ", r.run.model.name || r.run.model.model, " \xB7", " ", r.run.model.provider), r.extensionChanged && /* @__PURE__ */ import_react5.default.createElement("p", { className: "el-review-notice" }, "\u6269\u5C55\u63D0\u793A\u8BCD\u5DF2\u66F4\u6539\uFF0C\u91CD\u65B0\u5BA1\u67E5\u5168\u90E8\u540E\u6309\u65B0\u8981\u6C42\u751F\u6210\u7ED3\u8BBA\u3002"), /* @__PURE__ */ import_react5.default.createElement("div", { className: "el-review-toolbar" }, /* @__PURE__ */ import_react5.default.createElement(
    IconButton,
    {
      label: tree ? "\u6536\u8D77\u6587\u4EF6\u680F" : "\u5C55\u5F00\u6587\u4EF6\u680F",
      icon: "tree",
      size: "tree",
      "aria-expanded": tree,
      onClick: () => setTree(!tree)
    }
  ), /* @__PURE__ */ import_react5.default.createElement("div", { className: "el-view-switch", role: "tablist", "aria-label": "\u4E3B\u533A\u57DF\u89C6\u56FE" }, /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      className: "el-btn",
      role: "tab",
      "aria-selected": state.view === "overview",
      "aria-pressed": state.view === "overview",
      onClick: () => runtime.update({ view: "overview" })
    },
    "\u53D8\u66F4\u8BF4\u660E"
  ), /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      className: "el-btn",
      role: "tab",
      "aria-selected": state.view === "diff",
      "aria-pressed": state.view === "diff",
      onClick: () => runtime.update({ view: "diff" })
    },
    "\u6587\u4EF6\u5BF9\u6BD4"
  )), busy ? /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      className: "el-btn",
      onClick: () => runtime.perform(
        () => runtime.run("cancel", args(), { open: false }).then(() => runtime.reloadRecord())
      )
    },
    "\u53D6\u6D88\u5BA1\u67E5"
  ) : /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, reviewActionLabel ? /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      className: "el-primary",
      disabled: r.readOnly || !gate,
      onClick: () => review()
    },
    reviewActionLabel
  ) : !run?.complete && /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      className: "el-status-link",
      onClick: () => {
        runtime.update({ view: "overview" });
        queueMicrotask(
          () => document.getElementById("overview-problems")?.scrollIntoView({ block: "start" })
        );
      }
    },
    r.statusText
  )), /* @__PURE__ */ import_react5.default.createElement(
    "div",
    {
      className: "el-file-filter " + (state.view !== "diff" ? "el-invisible" : ""),
      role: "radiogroup",
      "aria-label": "\u6587\u4EF6\u8FC7\u6EE4",
      "aria-hidden": state.view !== "diff"
    },
    [
      ["all", "\u5168\u90E8\u6587\u4EF6", files.length],
      ["risk", "\u98CE\u9669\u6587\u4EF6", risk.size],
      ...changed.size > 0 && changed.size < files.length ? [["changed", "\u65B0\u6539\u52A8", changed.size]] : []
    ].map(([id, label, count]) => /* @__PURE__ */ import_react5.default.createElement("label", { key: id, "data-filter-mode": id }, /* @__PURE__ */ import_react5.default.createElement(
      "input",
      {
        type: "radio",
        name: "el-file-filter",
        checked: filter === id,
        value: id,
        tabIndex: state.view === "diff" ? 0 : -1,
        onChange: () => setFilter(String(id))
      }
    ), /* @__PURE__ */ import_react5.default.createElement("span", { className: "el-file-filter-option" }, /* @__PURE__ */ import_react5.default.createElement(
      "span",
      {
        className: "el-file-filter-label el-file-filter-label--" + id
      },
      label
    ), /* @__PURE__ */ import_react5.default.createElement(
      "b",
      {
        className: "el-file-filter-count el-file-filter-count--" + id
      },
      count
    ))))
  ), /* @__PURE__ */ import_react5.default.createElement("span", { className: "el-header-spacer" }), /* @__PURE__ */ import_react5.default.createElement(
    "span",
    {
      className: state.view !== "diff" ? "el-invisible" : "",
      "aria-hidden": state.view !== "diff"
    },
    /* @__PURE__ */ import_react5.default.createElement(
      IconButton,
      {
        label: split ? "\u5207\u6362\u4E3A\u5355\u680F" : "\u5207\u6362\u4E3A\u53CC\u680F",
        icon: "split",
        size: "toolbar",
        tabIndex: state.view === "diff" ? 0 : -1,
        onClick: () => setSplit(!split)
      }
    )
  ), /* @__PURE__ */ import_react5.default.createElement(
    Menu,
    {
      label: "\u5BFC\u51FA\u4E0E\u53D1\u56DE",
      icon: "download",
      size: "toolbar",
      items: [
        {
          label: "\u53D8\u66F4\u65E5\u5FD7\uFF08Markdown\uFF09",
          action: () => runtime.perform(() => runtime.download("md"))
        },
        {
          label: "\u8BC4\u5BA1\u62A5\u544A\uFF08HTML\uFF09",
          action: () => runtime.perform(() => runtime.download("html"))
        },
        {
          label: "\u5D4C\u5165\u5B8C\u6574 Diff",
          checkbox: true,
          keepOpen: true,
          selected: state.data.settings.exportEmbedDiff,
          action: () => runtime.perform(async () => {
            await runtime.api("settings", {
              workspaceId: runtime.workspaceId(),
              settings: {
                ...state.data.settings,
                exportEmbedDiff: !state.data.settings.exportEmbedDiff
              }
            });
            await runtime.refresh();
          })
        },
        { separator: true },
        {
          label: "\u53D1\u56DE\u4F1A\u8BDD \xB7 \u4FEE\u6539\u95EE\u9898",
          disabled: !r.delivery.sessionIds.length || !r.run,
          action: () => setDraftTemplate("issues")
        },
        {
          label: "\u53D1\u56DE\u4F1A\u8BDD \xB7 \u8865\u5145\u8BF4\u660E",
          disabled: !r.delivery.sessionIds.length || !r.run?.understanding,
          action: () => setDraftTemplate("understanding")
        },
        { separator: true },
        {
          label: "\u5168\u90E8\u91CD\u65B0\u5BA1\u67E5",
          disabled: r.readOnly || busy || !gate,
          danger: true,
          action: () => review(true)
        }
      ]
    }
  ), /* @__PURE__ */ import_react5.default.createElement(
    IconButton,
    {
      label: "\u5DE5\u4F5C\u533A\u8BBE\u7F6E",
      icon: "settings",
      size: "toolbar",
      onClick: openSettings
    }
  )), /* @__PURE__ */ import_react5.default.createElement("div", { ref: bodyRef, className: "el-review-body" }, tree && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement("aside", { className: "el-file-tree", style: { width } }, /* @__PURE__ */ import_react5.default.createElement("label", { className: "el-search" }, /* @__PURE__ */ import_react5.default.createElement(Icon, { name: "search", size: 14 }), /* @__PURE__ */ import_react5.default.createElement(
    "input",
    {
      type: "search",
      "aria-label": "\u641C\u7D22\u6587\u4EF6\u6216\u8DEF\u5F84",
      placeholder: "\u641C\u7D22\u6587\u4EF6\u6216\u8DEF\u5F84",
      value: query,
      onChange: (e) => setQuery(e.target.value)
    }
  )), /* @__PURE__ */ import_react5.default.createElement("nav", { "aria-label": "\u6539\u52A8\u6587\u4EF6" }, /* @__PURE__ */ import_react5.default.createElement(
    FileTree,
    {
      files: shown,
      selected,
      weak: state.view === "overview",
      risk,
      reviewed: r.run?.coverage.reviewed || [],
      jump,
      searching: Boolean(query)
    }
  )), !shown.length && /* @__PURE__ */ import_react5.default.createElement("p", { className: "el-muted" }, "\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u6587\u4EF6\u3002")), /* @__PURE__ */ import_react5.default.createElement(
    "div",
    {
      className: "el-tree-resizer",
      role: "separator",
      tabIndex: 0,
      "aria-label": "\u8C03\u6574\u6587\u4EF6\u680F\u5BBD\u5EA6",
      "aria-orientation": "vertical",
      "aria-valuemin": 180,
      "aria-valuemax": 480,
      "aria-valuenow": Math.round(width),
      onPointerDown: startResize,
      onKeyDown: (e) => {
        if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          setWidth(
            Math.max(
              180,
              Math.min(480, width + (e.key === "ArrowLeft" ? -16 : 16))
            )
          );
        }
      }
    }
  )), state.view === "overview" ? /* @__PURE__ */ import_react5.default.createElement(Overview, { runtime, record: r, jump }) : /* @__PURE__ */ import_react5.default.createElement(
    Diff,
    {
      key: r.snapshot.snapshotId,
      runtime,
      record: r,
      path: selected,
      sideBySide: split,
      anchor,
      showExplanation: explanation,
      onToggleExplanation: () => setExplanation(!explanation),
      onFile: jump
    }
  )), draftTemplate && /* @__PURE__ */ import_react5.default.createElement(
    DraftDialog,
    {
      runtime,
      record: r,
      template: draftTemplate,
      close: () => setDraftTemplate(null)
    }
  ));
}
function DraftDialog({
  runtime,
  record,
  template,
  close
}) {
  const [lock, setLock] = (0, import_react5.useState)(null), [result, setResult] = (0, import_react5.useState)(null), [error, setError] = (0, import_react5.useState)(""), [busy, setBusy] = (0, import_react5.useState)(false);
  (0, import_react5.useEffect)(() => {
    let live = true;
    runtime.api("draft/lock", {
      workspaceId: runtime.workspaceId(),
      deliveryId: record.delivery.deliveryId,
      snapshotId: record.snapshot.snapshotId,
      template
    }).then((value) => {
      if (live) setLock(value);
    }).catch((e) => {
      if (live) setError(errorMessage(e));
    });
    return () => {
      live = false;
    };
  }, []);
  const commit = async (choice) => {
    if (!lock?.available) return;
    setBusy(true);
    try {
      const value = await runtime.api("draft/commit", {
        token: lock.token,
        displayedSnapshotId: runtime.state.record?.snapshot.snapshotId,
        choice
      });
      setResult(value);
      if (value.status === "written") {
        close();
        await runtime.native.openSession(value.targetId);
      } else if (value.status === "failed") setError(value.reason);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ import_react5.default.createElement(
    Dialog,
    {
      title: template === "issues" ? "\u53D1\u56DE\u4F1A\u8BDD \xB7 \u4FEE\u6539\u95EE\u9898" : "\u53D1\u56DE\u4F1A\u8BDD \xB7 \u8865\u5145\u8BF4\u660E",
      close,
      className: "el-wide-dialog"
    },
    !lock && !error ? /* @__PURE__ */ import_react5.default.createElement("p", null, "\u6B63\u5728\u9501\u5B9A\u6240\u9009\u8BB0\u5F55\u7684\u5185\u5BB9\u2026") : lock?.available ? /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement("p", null, "\u4EE5\u4E0B\u5185\u5BB9\u5DF2\u9501\u5B9A\u4E3A ", localTime(record.snapshot.createdAt), " ", "\u7684\u5BA1\u67E5\u8BB0\u5F55\u3002\u53EA\u5199\u8349\u7A3F\uFF0C\u4E0D\u53D1\u9001\u3002"), template === "understanding" && /* @__PURE__ */ import_react5.default.createElement("p", null, "\u8BF7\u5728\u4F1A\u8BDD\u8349\u7A3F\u91CC\u586B\u5199\u6240\u9700 Skill \u540D\u79F0\uFF1B\u63D2\u4EF6\u4E0D\u4F1A\u8BFB\u53D6\u6216\u6267\u884C\u5B83\u3002"), /* @__PURE__ */ import_react5.default.createElement("textarea", { readOnly: true, "aria-label": "\u53D1\u56DE\u5185\u5BB9\u9884\u89C8", value: lock.text }), lock.omitted.length > 0 && /* @__PURE__ */ import_react5.default.createElement("p", null, "\u90E8\u5206\u6761\u76EE\u8D85\u8FC7\u957F\u5EA6\u4E0A\u9650\uFF0C\u7701\u7565\u6E05\u5355\u5DF2\u5199\u5728\u672B\u5C3E\u3002"), result?.status === "preview" && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement("p", null, "\u76EE\u6807\u4F1A\u8BDD\u5DF2\u6709\u8349\u7A3F\u3001\u5F15\u7528\u6216\u9644\u4EF6\u3002\u53EF\u8FFD\u52A0\u5230\u672B\u5C3E\u6216\u4EC5\u590D\u5236\u3002"), /* @__PURE__ */ import_react5.default.createElement("details", null, /* @__PURE__ */ import_react5.default.createElement("summary", null, "\u67E5\u770B\u5DF2\u6709\u8349\u7A3F"), /* @__PURE__ */ import_react5.default.createElement("pre", null, result.existingDraft.text || "\u5DF2\u6709\u5F15\u7528\u6216\u9644\u4EF6\u3002"))), result && result.status !== "preview" && /* @__PURE__ */ import_react5.default.createElement("p", { role: "status" }, result.status === "copied" ? "\u5DF2\u590D\u5236\u3002" : result.status === "unchanged" ? "\u76F8\u540C\u5185\u5BB9\u5DF2\u5728\u8349\u7A3F\u4E2D\u3002" : "reason" in result ? result.reason : ""), /* @__PURE__ */ import_react5.default.createElement("footer", null, /* @__PURE__ */ import_react5.default.createElement("button", { className: "el-btn", onClick: close }, "\u5173\u95ED"), /* @__PURE__ */ import_react5.default.createElement(
      "button",
      {
        className: "el-btn",
        disabled: busy,
        onClick: () => commit("copy")
      },
      "\u590D\u5236"
    ), /* @__PURE__ */ import_react5.default.createElement(
      "button",
      {
        className: "el-primary",
        disabled: busy,
        onClick: () => commit(result?.status === "preview" ? "append" : "auto")
      },
      busy ? "\u6B63\u5728\u5904\u7406" : result?.status === "preview" ? "\u8FFD\u52A0\u5230\u672B\u5C3E" : "\u5199\u5165\u4F1A\u8BDD\u8349\u7A3F"
    ))) : lock && !lock.available && /* @__PURE__ */ import_react5.default.createElement("p", null, lock.reason),
    error && /* @__PURE__ */ import_react5.default.createElement("p", { role: "alert", className: "el-error" }, error)
  );
}
function FileTree({
  files,
  selected,
  weak,
  risk,
  reviewed,
  jump,
  searching
}) {
  const [collapsed, setCollapsed] = (0, import_react5.useState)(/* @__PURE__ */ new Set());
  const root = { folders: /* @__PURE__ */ new Map(), files: [] };
  for (const file of files) {
    let node = root;
    const parts = file.path.split("/");
    let prefix = "";
    for (const part of parts.slice(0, -1)) {
      prefix += (prefix ? "/" : "") + part;
      if (!node.folders.has(part))
        node.folders.set(part, { folders: /* @__PURE__ */ new Map(), files: [], path: prefix });
      node = node.folders.get(part);
    }
    node.files.push(file);
  }
  const extensions = {
    js: "javascript",
    ts: "typescript",
    jsx: "react",
    tsx: "react_ts",
    css: "css",
    vue: "vue",
    html: "html",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    py: "python",
    java: "java",
    go: "go",
    rs: "rust",
    sh: "file"
  };
  const icon = (key) => /* @__PURE__ */ import_react5.default.createElement(
    "img",
    {
      alt: "",
      "aria-hidden": "true",
      className: "el-material-icon",
      src: "/api/dsh-evidentloop/assets/material/" + key + ".svg"
    }
  );
  const render = (node) => /* @__PURE__ */ import_react5.default.createElement("div", { className: "el-tree-level" }, [...node.folders].sort(([a], [b]) => a.localeCompare(b)).map(([name2, child]) => {
    const closed = !searching && collapsed.has(child.path), folder = ["src", "scripts", "docs"].includes(name2) ? "folder-" + name2 : "folder";
    return /* @__PURE__ */ import_react5.default.createElement("div", { key: child.path }, /* @__PURE__ */ import_react5.default.createElement(
      "button",
      {
        className: "el-tree-folder",
        "aria-expanded": !closed,
        onClick: () => setCollapsed((old) => {
          const next = new Set(old);
          next.has(child.path) ? next.delete(child.path) : next.add(child.path);
          return next;
        })
      },
      /* @__PURE__ */ import_react5.default.createElement(Icon, { name: closed ? "down" : "up", size: 12 }),
      icon(folder + (closed ? "" : "-open")),
      /* @__PURE__ */ import_react5.default.createElement(Clip, null, name2)
    ), !closed && /* @__PURE__ */ import_react5.default.createElement("div", { className: "el-tree-children" }, render(child)));
  }), node.files.map((file) => /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      key: file.path,
      title: file.path,
      className: "el-tree-file " + (selected === file.path ? weak ? "el-tree-weak" : "el-tree-selected" : ""),
      onClick: () => jump({ path: file.path })
    },
    icon(extensions[file.path.split(".").at(-1) || ""] || "file"),
    /* @__PURE__ */ import_react5.default.createElement(Clip, null, basename(file.path)),
    risk.has(file.path) ? /* @__PURE__ */ import_react5.default.createElement("span", { className: "el-risk-dot", "aria-label": "\u6709\u6709\u6548\u95EE\u9898" }) : reviewed.includes(file.path) ? /* @__PURE__ */ import_react5.default.createElement(Icon, { name: "check", size: 14 }) : null
  )));
  return render(root);
}

// plugin/client/settings.tsx
var import_react6 = __toESM(require("react"), 1);
var import_react_dom3 = require("react-dom");
function Settings({
  runtime,
  settings,
  workspaceId,
  anchor,
  sharedRepo,
  close
}) {
  const [draft, setDraft] = (0, import_react6.useState)({ ...settings }), [error, setError] = (0, import_react6.useState)(""), [editing, setEditing] = (0, import_react6.useState)(false), [saving, setSaving] = (0, import_react6.useState)(false), latest = (0, import_react6.useRef)({ ...settings }), tail = (0, import_react6.useRef)(Promise.resolve()), ref = (0, import_react6.useRef)(null);
  const rect = anchor?.getBoundingClientRect(), left = Math.max(
    8,
    Math.min(
      (rect?.right ?? innerWidth - 16) - 360 || innerWidth - 376,
      innerWidth - 368
    )
  ), top = Math.min(
    (rect?.bottom ?? 66) + 6 || 72,
    Math.max(8, innerHeight - 420)
  );
  (0, import_react6.useEffect)(() => {
    queueMicrotask(() => ref.current?.querySelector("input")?.focus());
    return () => {
      if (anchor?.isConnected) anchor.focus();
    };
  }, []);
  (0, import_react6.useEffect)(() => {
    const outside = (e) => {
      if (!editing && !ref.current?.contains(e.target) && !anchor?.contains(e.target))
        close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [editing]);
  const persist = (key, value) => {
    const next = { ...latest.current, [key]: value };
    latest.current = next;
    setDraft(next);
    setSaving(true);
    setError("");
    const job = tail.current.catch(() => {
    }).then(() => runtime.api("settings", { workspaceId, settings: next })).then(async () => {
      await runtime.refresh();
      return true;
    }).catch((e) => {
      setError(errorMessage(e));
      return false;
    }).finally(() => setSaving(false));
    tail.current = job;
    return job;
  };
  return (0, import_react_dom3.createPortal)(
    /* @__PURE__ */ import_react6.default.createElement(
      "div",
      {
        className: "el-plugin el-settings-popover",
        ref,
        role: "dialog",
        "aria-label": "\u5DE5\u4F5C\u533A\u8BBE\u7F6E",
        style: { left, top },
        onKeyDown: (e) => {
          if (e.key === "Escape" && !!e.nativeEvent.isComposing && !editing) {
            e.stopPropagation();
            close();
          }
        }
      },
      /* @__PURE__ */ import_react6.default.createElement("h2", null, "\u5DE5\u4F5C\u533A\u8BBE\u7F6E"),
      /* @__PURE__ */ import_react6.default.createElement("p", { className: "el-muted" }, sharedRepo ? "\u8FD9\u4E9B\u8BBE\u7F6E\u5BF9\u540C\u4E00\u4ED3\u5E93\u7684\u6240\u6709\u5DE5\u4F5C\u533A\u751F\u6548" : "\u8FD9\u4E9B\u8BBE\u7F6E\u5BF9\u5F53\u524D\u5DE5\u4F5C\u533A\u6240\u5C5E\u4ED3\u5E93\u751F\u6548"),
      /* @__PURE__ */ import_react6.default.createElement("label", { className: "el-setting-row" }, /* @__PURE__ */ import_react6.default.createElement("span", null, /* @__PURE__ */ import_react6.default.createElement("strong", null, "\u81EA\u52A8\u5BA1\u67E5"), /* @__PURE__ */ import_react6.default.createElement("small", null, "\u81EA\u52A8\u5BA1\u67E5\u5C1A\u672A\u542F\u7528\uFF0C\u6B64\u504F\u597D\u4F1A\u4FDD\u7559\u3002")), /* @__PURE__ */ import_react6.default.createElement(
        "input",
        {
          type: "checkbox",
          checked: draft.autoMode,
          onChange: (e) => persist("autoMode", e.target.checked)
        }
      )),
      /* @__PURE__ */ import_react6.default.createElement("label", { className: "el-setting-field" }, /* @__PURE__ */ import_react6.default.createElement("strong", null, "\u76EE\u6807\u5206\u652F"), /* @__PURE__ */ import_react6.default.createElement("small", null, "\u7559\u7A7A\u81EA\u52A8\u68C0\u6D4B\uFF1B\u4E0B\u6B21\u751F\u6210\u5BA1\u67E5\u65F6\u4F7F\u7528\uFF0C\u4E0D\u6539\u53D8\u5F53\u524D Diff\u3002"), /* @__PURE__ */ import_react6.default.createElement(
        "input",
        {
          value: draft.targetBranch,
          onChange: (e) => persist("targetBranch", e.target.value),
          placeholder: "\u81EA\u52A8\u68C0\u6D4B"
        }
      )),
      /* @__PURE__ */ import_react6.default.createElement("div", { className: "el-setting-row" }, /* @__PURE__ */ import_react6.default.createElement("span", null, /* @__PURE__ */ import_react6.default.createElement("strong", null, "\u6269\u5C55\u63D0\u793A\u8BCD"), /* @__PURE__ */ import_react6.default.createElement("small", null, draft.extensionPrompt.trim() ? "\u5DF2\u914D\u7F6E \xB7 " + Array.from(draft.extensionPrompt).length + " \u5B57" : "\u672A\u914D\u7F6E")), /* @__PURE__ */ import_react6.default.createElement(Link, { onClick: () => setEditing(true) }, "\u7F16\u8F91")),
      /* @__PURE__ */ import_react6.default.createElement("label", { className: "el-setting-row" }, /* @__PURE__ */ import_react6.default.createElement("span", null, /* @__PURE__ */ import_react6.default.createElement("strong", null, "HTML \u62A5\u544A\u5BFC\u51FA"), /* @__PURE__ */ import_react6.default.createElement("small", null, "HTML \u62A5\u544A\u9ED8\u8BA4\u5D4C\u5165\u5B8C\u6574 Diff")), /* @__PURE__ */ import_react6.default.createElement(
        "input",
        {
          type: "checkbox",
          checked: draft.exportEmbedDiff,
          onChange: (e) => persist("exportEmbedDiff", e.target.checked)
        }
      )),
      /* @__PURE__ */ import_react6.default.createElement("p", { className: "el-muted", role: "status" }, saving ? "\u6B63\u5728\u4FDD\u5B58\u2026" : "\u4EC5\u5728\u672C\u673A\u5F53\u524D DSH \u5B9E\u4F8B\u4FDD\u5B58\u3002"),
      error && /* @__PURE__ */ import_react6.default.createElement("p", { role: "alert", className: "el-error" }, error),
      editing && /* @__PURE__ */ import_react6.default.createElement(
        ExtensionEditor,
        {
          value: draft.extensionPrompt,
          save: async (text) => {
            const ok = await persist("extensionPrompt", text);
            if (ok) setEditing(false);
            return ok;
          },
          close: () => setEditing(false)
        }
      )
    ),
    document.body
  );
}
function ExtensionEditor({
  value,
  save,
  close
}) {
  const initial = (0, import_react6.useRef)(value).current, [saving, setSaving] = (0, import_react6.useState)(false), [text, setText] = (0, import_react6.useState)(value), [discard, setDiscard] = (0, import_react6.useState)(false), [error, setError] = (0, import_react6.useState)("");
  const update = (value2) => setText(value2.replace(/\r\n?/g, "\n")), count = Array.from(text).length;
  const requestClose = () => text !== initial ? setDiscard(true) : close();
  const load = async (event) => {
    try {
      const file = event.target.files?.[0];
      if (file) {
        if (!file.name.toLowerCase().endsWith(".md"))
          throw Error("\u8BF7\u9009\u62E9 Markdown (.md) \u6587\u4EF6");
        update(await file.text());
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      event.target.value = "";
    }
  };
  return /* @__PURE__ */ import_react6.default.createElement(
    Dialog,
    {
      title: "\u7F16\u8F91\u6269\u5C55\u63D0\u793A\u8BCD",
      close: requestClose,
      className: "el-wide-dialog"
    },
    /* @__PURE__ */ import_react6.default.createElement("p", null, "\u968F\u6BCF\u6B21\u5BA1\u67E5\u53D1\u9001\u3002\u53EF\u8865\u5145\u5173\u6CE8\u70B9\u3001\u5FFD\u7565\u9879\u4E0E\u4E25\u91CD\u5EA6\u6807\u51C6\uFF1B\u4E0D\u80FD\u6539\u53D8\u8F93\u51FA\u683C\u5F0F\u3001\u8BC1\u636E\u8981\u6C42\u53CA\u95EE\u9898\u8FB9\u754C\u3002"),
    /* @__PURE__ */ import_react6.default.createElement("div", { className: "el-extension-tools" }, /* @__PURE__ */ import_react6.default.createElement("label", { className: "el-file-button" }, "\u5BFC\u5165 .md", /* @__PURE__ */ import_react6.default.createElement("input", { type: "file", accept: ".md,text/markdown", onChange: load })), /* @__PURE__ */ import_react6.default.createElement("button", { className: "el-btn", onClick: () => update("") }, "\u6E05\u7A7A"), /* @__PURE__ */ import_react6.default.createElement(
      "span",
      {
        className: count > 2e4 ? "el-error" : "el-muted",
        "aria-live": "polite"
      },
      count,
      " / 20000 \u5B57"
    )),
    /* @__PURE__ */ import_react6.default.createElement("div", { className: "el-extension-columns" }, /* @__PURE__ */ import_react6.default.createElement(
      "textarea",
      {
        "aria-label": "\u6269\u5C55\u63D0\u793A\u8BCD",
        value: text,
        onChange: (e) => update(e.target.value),
        spellCheck: false
      }
    ), /* @__PURE__ */ import_react6.default.createElement("section", { "aria-label": "\u6269\u5C55\u63D0\u793A\u8BCD\u5B9E\u65F6\u9884\u89C8" }, /* @__PURE__ */ import_react6.default.createElement(Prose, { text: text || "\u9884\u89C8\u5C06\u663E\u793A\u5728\u8FD9\u91CC\u3002" }))),
    error && /* @__PURE__ */ import_react6.default.createElement("p", { role: "alert", className: "el-error" }, error),
    /* @__PURE__ */ import_react6.default.createElement("footer", null, /* @__PURE__ */ import_react6.default.createElement("button", { className: "el-btn", onClick: requestClose }, "\u53D6\u6D88"), /* @__PURE__ */ import_react6.default.createElement(
      "button",
      {
        className: "el-primary",
        disabled: count > 2e4 || saving,
        onClick: async () => {
          setSaving(true);
          try {
            if (await save(text) === false)
              setError("\u4FDD\u5B58\u5931\u8D25\uFF0C\u4FEE\u6539\u4ECD\u4FDD\u7559\u5728\u7F16\u8F91\u5668\u4E2D\u3002");
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setSaving(false);
          }
        }
      },
      saving ? "\u6B63\u5728\u4FDD\u5B58" : "\u4FDD\u5B58"
    )),
    discard && /* @__PURE__ */ import_react6.default.createElement(Dialog, { title: "\u653E\u5F03\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF1F", close: () => setDiscard(false) }, /* @__PURE__ */ import_react6.default.createElement("p", null, "\u6269\u5C55\u63D0\u793A\u8BCD\u5C1A\u672A\u4FDD\u5B58\u3002"), /* @__PURE__ */ import_react6.default.createElement("footer", null, /* @__PURE__ */ import_react6.default.createElement(
      "button",
      {
        className: "el-btn",
        "data-autofocus": true,
        onClick: () => setDiscard(false)
      },
      "\u7EE7\u7EED\u7F16\u8F91"
    ), /* @__PURE__ */ import_react6.default.createElement("button", { className: "el-btn", onClick: close }, "\u653E\u5F03\u4FEE\u6539")))
  );
}

// plugin/client/app.tsx
function Panel({ runtime }) {
  const state = (0, import_react7.useSyncExternalStore)(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot
  ), [settings, setSettings] = (0, import_react7.useState)(null), data = state.data;
  (0, import_react7.useEffect)(() => {
    runtime.refresh();
  }, [runtime]);
  const openSettings = (event) => {
    if (data?.settings)
      setSettings({
        workspaceId: runtime.workspaceId(),
        settings: data.settings,
        anchor: event.currentTarget,
        sharedRepo: data.workspaces.filter(
          (w) => w.projectKey === data.project?.projectKey
        ).length > 1
      });
  };
  return /* @__PURE__ */ import_react7.default.createElement(
    "main",
    {
      className: "el-plugin",
      "data-testid": "evidentloop-panel",
      "aria-label": "AI \u53D8\u66F4\u8BC4\u5BA1 \xB7 EvidentLoop"
    },
    state.page === "list" && /* @__PURE__ */ import_react7.default.createElement("header", { className: "el-page-header" }, /* @__PURE__ */ import_react7.default.createElement("h1", { title: "AI \u53D8\u66F4\u8BC4\u5BA1 \xB7 EvidentLoop" }, "\u53D8\u66F4\u8BC4\u5BA1"), data && /* @__PURE__ */ import_react7.default.createElement(WorkspacePicker, { runtime, state }), /* @__PURE__ */ import_react7.default.createElement("span", { className: "el-header-spacer" }), /* @__PURE__ */ import_react7.default.createElement("label", { className: "el-search" }, /* @__PURE__ */ import_react7.default.createElement(Icon, { name: "search", size: 14 }), /* @__PURE__ */ import_react7.default.createElement(
      "input",
      {
        type: "search",
        "aria-label": "\u641C\u7D22\u4EA4\u4ED8\u3001\u5206\u652F\u6216\u9700\u6C42\u7F16\u53F7",
        placeholder: "\u641C\u7D22\u4EA4\u4ED8\u3001\u5206\u652F\u6216\u9700\u6C42\u7F16\u53F7",
        disabled: !data,
        value: state.query || "",
        onChange: (e) => runtime.update({ query: e.target.value })
      }
    )), /* @__PURE__ */ import_react7.default.createElement(
      IconButton,
      {
        label: "\u5DE5\u4F5C\u533A\u8BBE\u7F6E",
        icon: "settings",
        onClick: openSettings,
        disabled: !data?.project?.projectKey
      }
    )),
    state.error && /* @__PURE__ */ import_react7.default.createElement("div", { role: "alert", className: "el-error" }, state.error, /* @__PURE__ */ import_react7.default.createElement("button", { className: "el-btn", onClick: () => runtime.refresh() }, "\u91CD\u65B0\u52A0\u8F7D"), /* @__PURE__ */ import_react7.default.createElement(
      "button",
      {
        className: "el-btn",
        onClick: () => runtime.update({ error: "" })
      },
      "\u5173\u95ED"
    )),
    state.notice && /* @__PURE__ */ import_react7.default.createElement("div", { role: "status", className: "el-notice" }, state.notice, /* @__PURE__ */ import_react7.default.createElement(
      "button",
      {
        className: "el-btn",
        onClick: () => runtime.update({ notice: "" })
      },
      "\u5173\u95ED"
    )),
    data?.modelTestGate && !data.modelTestGate.approved && /* @__PURE__ */ import_react7.default.createElement("p", { className: "el-test-gate" }, "\u6F14\u793A\u6A21\u5F0F\uFF1A\u672A\u5F00\u542F\u771F\u5B9E\u6A21\u578B\u8C03\u7528\u3002\u5F53\u524D\u53EF\u67E5\u770B\u4EE3\u7801\u4E0E\u5DF2\u6709\u5BA1\u67E5\u8BB0\u5F55\u3002"),
    state.loading ? /* @__PURE__ */ import_react7.default.createElement("p", { role: "status" }, "\u6B63\u5728\u8BFB\u53D6\u5DE5\u4F5C\u533A\u2026") : !data ? /* @__PURE__ */ import_react7.default.createElement("section", { className: "el-empty" }, "\u63D2\u4EF6\u5C1A\u672A\u8FDE\u63A5\uFF0C\u65E0\u6CD5\u8BFB\u53D6\u4EA4\u4ED8\u3002") : state.page === "preparing" ? /* @__PURE__ */ import_react7.default.createElement("section", { className: "el-empty", role: "status" }, "\u6B63\u5728\u51BB\u7ED3\u5BA1\u67E5\u8F93\u5165\uFF0C\u4E0D\u8C03\u7528\u6A21\u578B\u2026") : state.page === "review" && state.record ? /* @__PURE__ */ import_react7.default.createElement(Review, { runtime, state, openSettings }) : /* @__PURE__ */ import_react7.default.createElement(DeliveryList, { runtime, state }),
    settings && /* @__PURE__ */ import_react7.default.createElement(
      Settings,
      {
        runtime,
        workspaceId: settings.workspaceId,
        settings: settings.settings,
        anchor: settings.anchor,
        sharedRepo: settings.sharedRepo,
        close: () => setSettings(null)
      }
    )
  );
}

// plugin/client/native.ts
var NativeClient = class {
  constructor(ctx) {
    this.ctx = ctx;
  }
  ctx;
  workspaceState() {
    return this.ctx.get("uiWorkspace").workspaces.list.getSnapshot();
  }
  sessionId() {
    return this.ctx.get("uiSession").current.getSnapshot()?.key || null;
  }
  workspaceId() {
    const w = this.ctx.get("uiWorkspace"), selection = w.selection?.getSnapshot?.();
    return selection?.workspaceId || this.workspaceState().items.find(
      (x) => x.sessionIds.includes(this.sessionId() || "")
    )?.workspaceId || null;
  }
  subscribe(callback) {
    const w = this.ctx.get("uiWorkspace"), services = [
      w.workspaces.list,
      w.selection,
      this.ctx.get("uiSession").current
    ];
    const disposers = services.filter((x) => x?.subscribe).map((x) => x.subscribe(callback));
    return () => disposers.forEach((off) => {
      if (typeof off === "function") off();
    });
  }
  async selectWorkspace(id) {
    await this.ctx.get("uiWorkspace").openWorkspace(id);
    this.ctx.layout.selectPanel("dsh-evidentloop");
  }
  async openSession(id) {
    await this.ctx.get("uiWorkspace").openSession(id);
  }
  showPanel() {
    this.ctx.layout.selectPanel("dsh-evidentloop");
  }
  async input(id, action, expiresAt) {
    const sessions = this.ctx.get("uiSession").sessions, lease = sessions.retain(id, { source: "dsh-evidentloop" });
    let timer;
    try {
      await Promise.race([
        lease.ready,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(Error("\u4F1A\u8BDD\u8F93\u5165\u6846\u52A0\u8F7D\u8D85\u65F6")),
            Math.max(0, expiresAt - Date.now())
          );
        })
      ]);
      if (Date.now() >= expiresAt) throw Error("\u64CD\u4F5C\u5DF2\u8FC7\u671F\uFF0C\u672A\u4FEE\u6539\u8349\u7A3F");
      const binding = sessions.binding(id);
      if (!binding) throw Error("\u4F1A\u8BDD\u8F93\u5165\u6846\u4E0D\u53EF\u7528");
      return await action(
        binding.ctx.get("conversation").input.for(binding.ctx)
      );
    } finally {
      clearTimeout(timer);
      lease.release();
    }
  }
  async execute(action, payload, expiresAt = Date.now() + 1e4) {
    if (Date.now() >= expiresAt) throw Error("\u64CD\u4F5C\u5DF2\u8FC7\u671F");
    if (action === "copy") {
      if (!navigator.clipboard?.writeText) throw Error("\u526A\u8D34\u677F\u4E0D\u53EF\u7528");
      await navigator.clipboard.writeText(
        payload.text
      );
      return { copied: true };
    }
    if (action === "openFile") {
      const remote = this.ctx.get("remote")?.session;
      if (!remote?.openWorkspacePath) throw Error("\u5BBF\u4E3B\u672A\u63D0\u4F9B\u6587\u4EF6\u6253\u5F00\u63A5\u53E3");
      return remote.openWorkspacePath(
        { path: payload.path },
        AbortSignal.timeout(Math.max(1, expiresAt - Date.now()))
      );
    }
    const sessionId = payload.sessionId;
    return this.input(
      sessionId,
      async (input) => {
        if (action === "getDraft") {
          const draft = input.draftSnapshot, state = input.state.getSnapshot();
          return {
            text: draft.text,
            revision: state.draftRev,
            quotes: draft.quotes || [],
            references: draft.references || [],
            attachments: state.attachmentIds || []
          };
        }
        if (action === "quote") {
          const quote = payload;
          const draft = input.draftSnapshot, state = input.state.getSnapshot();
          const content = quote.summary + "\n```\n" + quote.code + "\n```\n\u8BF7\u7ED3\u5408\u4E0A\u4E0B\u6587\u5206\u6790\u8FD9\u6BB5\u4EE3\u7801\uFF0C\u662F\u5426\u5B58\u5728\u5B89\u5168\u6216\u903B\u8F91\u9690\u60A3\uFF0C\u4EE5\u53CA\u5982\u4F55\u6539\u8FDB\uFF1F";
          if (draft.text.includes(content)) {
            await this.openSession(sessionId);
            return { written: true, duplicate: true };
          }
          const result = await this.writeDraft(input, {
            text: draft.text + (draft.text ? "\n\n" : "") + content,
            expectedRevision: quote.expectedRevision ?? state.draftRev
          });
          if (result.written) await this.openSession(sessionId);
          return result;
        }
        if (action !== "writeDraft") throw Error("\u672A\u77E5\u539F\u751F\u64CD\u4F5C");
        return this.writeDraft(input, payload);
      },
      expiresAt
    );
  }
  async writeDraft(input, payload) {
    const before = structuredClone(input.draftSnapshot), state = input.state.getSnapshot();
    if (state.draftRev !== payload.expectedRevision || state.phase !== "plain")
      return { written: false };
    const attachmentIds = [...state.attachmentIds || []];
    input.actions.setDraft({ ...before, text: payload.text });
    const appliedRevision = input.state.getSnapshot().draftRev;
    await Promise.resolve();
    const after = input.draftSnapshot, next = input.state.getSnapshot();
    const same = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
    if (next.draftRev !== appliedRevision || after.text !== payload.text || !same(after.quotes, before.quotes) || !same(after.references, before.references) || !same(next.attachmentIds, attachmentIds)) {
      if (next.draftRev === appliedRevision) input.actions.setDraft(before);
      input.actions.persistDraft();
      return { written: false };
    }
    input.actions.persistDraft();
    return { written: true, revision: next.draftRev };
  }
};

// plugin/client/runtime.ts
var base = "/api/dsh-evidentloop/";
var ClientRuntime = class {
  native;
  clientId;
  listeners = /* @__PURE__ */ new Set();
  stopped = false;
  requestGeneration = 0;
  navigation = 0;
  recordGeneration = 0;
  annotationDrafts = /* @__PURE__ */ new Map();
  sessionContexts = /* @__PURE__ */ new Map();
  state;
  offNative;
  bridgeTimer;
  refreshTimer;
  constructor(native) {
    this.native = native;
    this.clientId = crypto.randomUUID();
    this.state = {
      loading: true,
      error: "",
      workspaceId: null,
      data: null,
      page: "list",
      record: null,
      view: "overview",
      query: "",
      listPreferences: {
        archived: false,
        onlyIssues: false,
        sort: "updated",
        compact: false
      },
      returnSessionId: null,
      notice: ""
    };
  }
  getSnapshot = () => this.state;
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  update(value) {
    this.state = { ...this.state, ...value };
    for (const fn of this.listeners) fn();
  }
  async api(route, value = null) {
    const response = await fetch(
      base + route,
      value ? {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...value, clientId: this.clientId })
      } : void 0
    );
    let data;
    try {
      data = await response.json();
    } catch {
      throw Error(
        "\u63D2\u4EF6\u63A5\u53E3\u672A\u52A0\u8F7D\uFF08" + response.status + "\uFF09\uFF0C\u8BF7\u91CD\u65B0\u52A0\u8F7D\u63D2\u4EF6\u3002"
      );
    }
    if (!response.ok || data?.error) throw Error(data?.error || "\u8FDE\u63A5\u8BF7\u6C42\u5931\u8D25");
    return data;
  }
  async refresh() {
    const generation = ++this.requestGeneration;
    try {
      const workspaceId = this.state.page !== "list" ? this.state.workspaceId : this.native.workspaceId() || this.state.workspaceId;
      const data = await this.api(
        workspaceId ? `bootstrap?workspaceId=${encodeURIComponent(workspaceId)}` : "bootstrap"
      );
      if (generation === this.requestGeneration && !this.stopped) {
        const selected = this.state.record, navigation = this.navigation, extensionChanged = this.state.data?.settings?.extensionPrompt !== data.settings?.extensionPrompt;
        this.update({ loading: false, data, workspaceId, error: "" });
        if (this.state.page === "review" && selected && (!selected.readOnly || extensionChanged)) {
          const d = data.deliveries.find(
            (d2) => d2.deliveryId === selected.delivery.deliveryId
          );
          if (workspaceId && d?.current?.snapshotId && (extensionChanged || d.current.snapshotId !== selected.snapshot.snapshotId || d.run?.runId !== selected.run?.runId || d.run?.status !== selected.run?.status)) {
            const record = await this.api(
              `record?${new URLSearchParams({ workspaceId, deliveryId: d.deliveryId, ...selected.readOnly ? { snapshotId: selected.snapshot.snapshotId } : {} })}`
            );
            if (generation === this.requestGeneration && navigation === this.navigation)
              this.update({ record });
          }
        }
      }
    } catch (error) {
      if (generation === this.requestGeneration)
        this.update({ loading: false, error: errorMessage(error) });
    }
  }
  async selectWorkspace(workspaceId) {
    const navigation = ++this.navigation;
    this.recordGeneration++;
    await this.native.selectWorkspace(workspaceId);
    if (navigation !== this.navigation) return;
    this.update({
      workspaceId,
      page: "list",
      record: null,
      returnSessionId: null
    });
    await this.refresh();
  }
  async open(deliveryId, view = "diff", snapshotId) {
    const generation = ++this.recordGeneration, navigation = ++this.navigation, workspaceId = this.workspaceId();
    const args = new URLSearchParams({ workspaceId, deliveryId });
    if (snapshotId) args.set("snapshotId", snapshotId);
    const record = await this.api(`record?${args}`);
    if (generation === this.recordGeneration && navigation === this.navigation && workspaceId === this.state.workspaceId)
      this.update({
        page: "review",
        record,
        view,
        error: ""
      });
  }
  async reloadRecord() {
    if (this.state.record)
      await this.open(
        this.state.record.delivery.deliveryId,
        this.state.view,
        this.state.record.snapshot.snapshotId
      );
    await this.refresh();
  }
  back() {
    const id = this.state.returnSessionId;
    this.navigation++;
    this.recordGeneration++;
    this.update({ page: "list", record: null, returnSessionId: null });
    if (id) this.native.openSession(id);
    else this.refresh();
  }
  async run(route, value, {
    open = true,
    view
  } = {}) {
    const navigation = this.navigation;
    const workspaceId = value.workspaceId || this.workspaceId();
    const { operationId } = await this.api(route, { ...value, workspaceId });
    await this.refresh();
    for (; ; ) {
      if (this.stopped) throw Error("\u754C\u9762\u5DF2\u5173\u95ED\uFF0C\u53EF\u91CD\u65B0\u6253\u5F00\u67E5\u770B\u8FD0\u884C\u72B6\u6001");
      const data = await this.api(
        `bootstrap?workspaceId=${encodeURIComponent(workspaceId)}`
      ), operation = data.operations.find((o) => o.id === operationId);
      if (!operation) throw Error("\u8FD0\u884C\u72B6\u6001\u5DF2\u91CD\u542F\uFF0C\u8BF7\u91CD\u65B0\u52A0\u8F7D");
      if (operation.status !== "running") {
        if (operation.status === "failed")
          throw Error(
            operation.error || operation.result?.reason || operation.result?.errorCode || "\u5BA1\u67E5\u5931\u8D25"
          );
        const result = operation.result || { status: operation.status };
        if (workspaceId === this.state.workspaceId) {
          await this.refresh();
          if (open && navigation === this.navigation && result?.deliveryId && result?.snapshotId)
            await this.open(
              result.deliveryId,
              view || this.state.view,
              result.snapshotId
            );
        }
        return result;
      }
      if (workspaceId === this.state.workspaceId) this.update({ data });
      await new Promise((r) => setTimeout(r, 700));
    }
  }
  async openFromSession(sessionId) {
    const context = await this.api(
      `session-context?sessionId=${encodeURIComponent(sessionId)}`
    );
    if (!context.available) throw Error("\u8BE5\u4F1A\u8BDD\u6CA1\u6709\u53EF\u7528\u7684Git\u5DE5\u4F5C\u533A");
    const navigation = ++this.navigation;
    this.recordGeneration++;
    this.update({
      page: "preparing",
      workspaceId: context.workspaceId,
      returnSessionId: sessionId
    });
    this.native.showPanel();
    try {
      const result = await this.run(
        "capture",
        { workspaceId: context.workspaceId, sessionId: context.sessionId },
        { view: "overview", open: false }
      );
      if (!result.snapshotId)
        throw Error(result.reason || "\u6CA1\u6709\u53EF\u751F\u6210\u5BA1\u67E5\u8BB0\u5F55\u7684\u6539\u52A8");
      if (navigation === this.navigation)
        await this.open(result.deliveryId, "overview", result.snapshotId);
    } catch (error) {
      if (navigation === this.navigation)
        this.update({ page: "list", error: errorMessage(error) });
      throw error;
    }
  }
  sessionContext(sessionId) {
    const old = this.sessionContexts.get(sessionId);
    if (old && Date.now() - old.at < 1e3) return old.promise;
    const promise = this.api(
      `session-context?sessionId=${encodeURIComponent(sessionId)}`
    );
    this.sessionContexts.set(sessionId, { at: Date.now(), promise });
    return promise;
  }
  download(format) {
    const r = this.state.record;
    if (!r) throw Error("\u6CA1\u6709\u6240\u9009\u5BA1\u67E5\u8BB0\u5F55");
    const query = new URLSearchParams({
      workspaceId: this.workspaceId(),
      deliveryId: r.delivery.deliveryId,
      snapshotId: r.snapshot.snapshotId,
      format
    });
    return fetch(base + "download?" + query).then(async (response) => {
      if (!response.ok) throw Error(await response.text());
      const blob = await response.blob(), a = document.createElement("a"), url = URL.createObjectURL(blob);
      a.href = url;
      a.download = r.delivery.title.replace(/[<>:"/\\|?*]/g, "_") + "." + format;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1e4);
    });
  }
  async perform(action) {
    try {
      return await action();
    } catch (error) {
      this.update({ error: errorMessage(error) });
      return null;
    }
  }
  workspaceId() {
    const id = this.state.workspaceId;
    if (!id) throw Error("\u8BF7\u9009\u62E9\u5DE5\u4F5C\u533A");
    return id;
  }
  start() {
    this.offNative = this.native.subscribe(() => this.refresh());
    this.refresh();
    const loop = async () => {
      if (this.stopped) return;
      try {
        const { jobs } = await this.api(
          `bridge/next?clientId=${encodeURIComponent(this.clientId)}`
        );
        for (const job of jobs) {
          let result, error;
          try {
            result = await this.native.execute(
              job.action,
              job.payload,
              job.expiresAt
            );
          } catch (e) {
            error = errorMessage(e);
          }
          await this.api("bridge/answer", {
            id: job.id,
            nonce: job.nonce,
            result,
            error
          });
        }
      } catch {
      } finally {
        if (!this.stopped) this.bridgeTimer = setTimeout(loop, 500);
      }
    };
    loop();
    this.refreshTimer = setInterval(() => {
      if (this.state.data?.operations.some((o) => o.status === "running"))
        this.refresh();
    }, 1e3);
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.bridgeTimer);
    clearInterval(this.refreshTimer);
    this.offNative?.();
  }
};

// plugin/client/styles.css
var styles_default = `/* Component colors resolve through --el-*; literals exist only in these token definitions. */
.el-plugin {
  --el-brand: var(--dsw-alias-state-business-primary, #4176e6); --el-brand-hover: var(--dsw-static-deepseek-450, #5686fe); --el-brand-tint: var(--dsw-alias-state-business-tertiary, #e4edfd); --el-brand-link: var(--dsw-static-deepseek-600, #4868b2); --el-brand-link-hover: var(--dsw-static-deepseek-600, #4868b2); --el-brand-ring: rgba(65, 118, 230, .16); --el-brand-border: rgba(65, 118, 230, .24);
  --el-label-1: var(--dsw-alias-label-primary, #202124); --el-label-2: var(--dsw-alias-label-secondary, #626772); --el-label-3: var(--dsw-alias-label-tertiary, #858a93);
  --el-bg-l1: var(--dsw-alias-bg-layer-2, #fff); --el-bg-l2: var(--dsw-alias-bg-layer-1, #f7f8fa); --el-border-l1: var(--dsw-alias-border-l2, #e5e7eb);
  --el-state-error: var(--dsw-alias-state-error-primary, #df2a3f); --el-state-error-tint: #fdeeee; --el-state-warn: var(--dsw-alias-state-warn-primary, #c37806); --el-state-success: var(--dsw-alias-state-success-primary, #199a68);
  --el-hover: var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, 0.06)); --el-bg-l3: var(--dsw-alias-bg-layer-3, #f1f2f4); --el-shadow-card: 0 1px 3px var(--el-shadow); --el-on-brand: #fff; --el-bg-overlay: rgb(0 0 0 / 28%); --el-shadow: rgb(0 0 0 / 10%); --el-font-code: "Maple Mono NF CN", "Sarasa Mono SC", "Noto Sans Mono CJK SC", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; --el-font-diff: var(--el-font-code);
  color: var(--el-label-1); background: var(--el-bg-l2); height: 100%; min-height: 0; min-width: 0; display: flex; flex-direction: column;
  font: 14px/1.6 system-ui, sans-serif; --el-frame-top-inset: 0px; padding-top: var(--el-frame-top-inset); box-sizing: border-box;
}
/* The host mounts its leading controls only for collapsed/drawer navigation. */
html[data-platform=darwin] :is([data-sidebar-collapsed], [data-sidebar-drawer]) main.el-plugin { --el-frame-top-inset: var(--dsh-frame-top-clearance, 0px); }
body[data-ds-dark-theme] .el-plugin { --el-brand: var(--dsw-alias-state-business-primary, #7aaaff); --el-brand-hover: var(--dsw-static-deepseek-300, #b7c8fe); --el-brand-tint: rgba(122, 170, 255, .14); --el-brand-link: var(--dsw-alias-link, #7aaaff); --el-brand-link-hover: var(--dsw-alias-link, #7aaaff); --el-brand-ring: rgba(122, 170, 255, .20); --el-brand-border: rgba(122, 170, 255, .28); --el-label-1: var(--dsw-alias-label-primary, #eceef1); --el-label-2: var(--dsw-alias-label-secondary, #afb4be); --el-label-3: var(--dsw-alias-label-tertiary, #858c97); --el-bg-l1: var(--dsw-alias-bg-layer-2, #24262c); --el-bg-l2: var(--dsw-alias-bg-layer-1, #1d1f24); --el-border-l1: var(--dsw-alias-border-l2, #3a3e48); --el-state-error: var(--dsw-alias-state-error-primary, #f85149); --el-state-error-tint: rgba(248, 81, 73, .14); --el-hover: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08)); --el-bg-l3: var(--dsw-alias-bg-layer-3, #2c2e34); --el-on-brand: #19151f; --el-shadow: rgb(0 0 0 / 25%); }
.el-plugin *, .el-plugin *::before, .el-plugin *::after { box-sizing: border-box; }
.el-plugin h1, .el-plugin h2, .el-plugin h3, .el-plugin h4, .el-plugin p { margin: 0; }
.el-plugin h1 { font-size: 20px; line-height: 28px; } .el-plugin h2 { font-size: 17px; } .el-plugin h3 { font-size: 15px; } .el-plugin h4 { font-size: 14px; }
.el-plugin button, .el-plugin input, .el-plugin select, .el-plugin textarea { font: inherit; color: inherit; }
.el-plugin button { appearance: none; border: 0; background: transparent; padding: 0; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.el-plugin .el-btn, .el-plugin .el-primary, .el-plugin select, .el-file-button { min-height: 32px; border: 1px solid var(--el-border-l1); border-radius: 6px; background: var(--el-bg-l1); padding: 4px 10px; cursor: pointer; }
.el-plugin .el-btn:hover { background: var(--el-bg-l2); } .el-plugin button:disabled { opacity: .45; cursor: not-allowed; }
.el-plugin button:focus-visible, .el-plugin input[type=checkbox]:focus-visible, .el-plugin select:focus-visible, .el-plugin [tabindex]:focus-visible, .el-plugin summary:focus-visible { outline: 2px solid var(--el-brand); outline-offset: -2px; }
.el-plugin input:not([type=checkbox]), .el-plugin textarea { background: var(--el-bg-l1); border: 1px solid var(--el-border-l1); border-radius: 6px; padding: 5px 10px; min-width: 0; }
.el-plugin input[type=checkbox] { accent-color: var(--el-brand); } .el-plugin input:not([type=checkbox]) { height: 32px; }
.el-plugin .el-primary { color: var(--el-brand-link); border-color: var(--el-brand); background: var(--el-bg-l1); } .el-plugin .el-primary:hover { background: var(--el-brand-tint); }
.el-plugin .el-icon-button { padding: 0; width: 32px; height: 32px; min-height: 32px; flex: 0 0 32px; color: var(--el-label-2); border: 0; background: transparent; }
.el-plugin .el-icon-button--sm { width: 20px; height: 20px; min-height: 20px; flex-basis: 20px; border-radius: 4px; }
.el-plugin .el-icon-button:hover { background: var(--el-hover); }
.el-plugin .el-icon-button[aria-pressed=true] { color: var(--el-brand); background: var(--el-brand-tint); }
.el-plugin .el-link, .el-plugin .el-ref, .el-plugin .el-summary-link { border: 0; padding: 0; background: transparent; color: var(--el-brand-link); min-height: 0; display: inline; text-align: left; cursor: pointer; }
.el-plugin .el-link { display: inline-flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%; white-space: nowrap; }
.el-link-arrow { opacity: 0; width: 12px; display: inline-block; transform: translateX(-3px); transition: opacity .3s ease-out, transform .3s ease-out; }
.el-plugin .el-link:hover, .el-plugin .el-link:focus-visible, .el-plugin .el-ref:hover, .el-plugin .el-ref:focus-visible { color: var(--el-brand-link-hover); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; background: transparent; }
.el-link:hover .el-link-arrow, .el-link:focus-visible .el-link-arrow { opacity: 1; transform: translateX(0); }
.el-header-spacer { flex: 1; min-width: 8px; } .el-muted { color: var(--el-label-2); } .el-path { font-family: var(--el-font-code); } .el-clip { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.el-plugin .el-danger, .el-plugin .el-error { color: var(--el-state-error); } .el-error, .el-notice { padding: 8px 12px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; } .el-notice { color: var(--el-label-2); background: var(--el-bg-l1); border-bottom: 1px solid var(--el-border-l1); }
.el-test-gate { color: var(--el-label-2); padding: 6px 16px; font-size: 12px; border-bottom: 1px solid var(--el-border-l1); }
.el-page-header { display: flex; align-items: center; gap: 12px; width: 100%; padding: 16px max(24px, calc((100% - 1280px) / 2 + 24px)); background: var(--el-bg-l1); border-bottom: 1px solid var(--el-border-l1); flex-wrap: wrap; }
.el-page-header h1 { flex: 0 0 auto; }
.el-search { display: flex; align-items: center; gap: 8px; width: 248px; max-width: 100%; height: 32px; padding: 0 10px; border: 1px solid var(--el-border-l1); border-radius: 6px; background: var(--el-bg-l2); color: var(--el-label-3); }
.el-search>svg { flex: 0 0 14px; } .el-plugin .el-search input { flex: 1; min-width: 0; width: 100%; height: 30px; padding: 0; margin: 0; border: 0; border-radius: 0; background: transparent; color: var(--el-label-1); font-size: 12px; }
.el-search:focus-within { border-color: var(--el-brand); box-shadow: 0 0 0 2px var(--el-brand-ring); } .el-plugin .el-search input:not([type=checkbox]):focus { box-shadow: none; }
.el-plugin .el-menu-trigger { min-height: 32px; padding: 4px 10px; border: 1px solid var(--el-border-l1); background: var(--el-bg-l1); } .el-plugin .el-menu-trigger:hover { background: var(--el-hover); }
.el-plugin .el-workspace-picker .el-menu-trigger { padding: 4px 8px; border: 0; background: transparent; } .el-plugin .el-workspace-picker .el-menu-trigger:hover { background: var(--el-hover); }
.el-plugin .el-list-controls>.el-menu-trigger { gap: 12px; background: var(--el-bg-l2); font-size: 12px; }
.el-workspace-picker { min-width: 0; max-width: 260px; } .el-menu-trigger { display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; max-width: 100%; }
.el-delivery-area { container-type: inline-size; display: flex; flex-direction: column; min-height: 0; flex: 1; width: 100%; max-width: 1280px; margin-inline: auto; }
.el-list-controls { display: flex; align-items: center; gap: 12px; padding: 12px 24px; flex-wrap: wrap; font-size: 13px; }
.el-plugin .el-list-controls [role=group] button { min-height: 32px; padding: 0 10px; border: 0; background: transparent; color: var(--el-label-2); }
.el-plugin .el-list-controls [role=group] .el-icon-button { padding: 0; }
.el-plugin .el-list-controls [role=group] button:hover, .el-plugin .el-list-controls [role=group] button[aria-pressed=true] { background: var(--el-hover); color: var(--el-label-1); }
.el-plugin .el-list-controls [aria-label="\u4EA4\u4ED8\u8303\u56F4"] button[aria-pressed=true] { font-weight: 600; }
.el-list-controls [role=group] { display: inline-flex; align-items: center; gap: 4px; } .el-list-controls label { display: inline-flex; align-items: center; gap: 6px; }
.el-card-scroll, .el-compact-scroll { container-type: inline-size; overflow: auto; padding: 0 24px 24px; min-height: 0; }
.el-delivery-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr)); gap: 16px; align-content: start; }
.el-delivery-grid:has(> .el-delivery-card:only-child) { grid-template-columns: minmax(min(320px, 100%), 480px); }
.el-delivery-card { position: relative; background: var(--el-bg-l1); border: 1px solid var(--el-border-l1); border-radius: 10px; padding: 16px; cursor: pointer; display: flex; flex-direction: column; gap: 12px; min-height: 188px; min-width: 0; }
.el-delivery-card:hover { border-color: var(--el-label-3); box-shadow: 0 2px 8px var(--el-shadow); } .el-delivery-card h2 { min-width: 0; padding-right: 32px; }
.el-plugin .el-title-link { min-height: 0; border: 0; background: transparent; padding: 0; max-width: 100%; color: var(--el-label-1); justify-content: flex-start; text-align: left; font-weight: 650; }
.el-delivery-card .el-title-link { font-size: 16px; } .el-pin { display: inline-flex; flex: 0 0 14px; color: var(--el-label-2); }
.el-card-meta { display: flex; align-items: center; gap: 12px; color: var(--el-label-2); font-size: 12px; } .el-card-meta>span:last-child { flex-shrink: 0; margin-left: auto; }
.el-result { color: var(--el-label-2); font-size: 13px; } .el-clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.el-card-summary { color: var(--el-label-2); } .el-delivery-card footer { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; }
.el-delivery-card footer>.el-link:first-child { max-width: calc(100% - 100px); } .el-delivery-card footer>.el-link:last-child { margin-left: auto; flex-shrink: 0; }
.el-card-menu { position: absolute; right: 12px; top: 12px; } .el-narrow-session { display: none; }
.el-empty { padding: 40px 24px; text-align: center; color: var(--el-label-2); } .el-empty p { margin-bottom: 12px; } .el-empty button { margin: 8px; }
.el-compact-table { width: 100%; max-width: 1280px; min-width: 540px; border: 1px solid var(--el-border-l1); border-radius: 8px; background: var(--el-bg-l1); font-size: 13px; }
.el-compact-head, .el-compact-row { display: grid; grid-template-columns: minmax(180px, 1.7fr) minmax(100px, 1fr) minmax(160px, 1.35fr) minmax(100px, 1fr) 78px 88px 32px; gap: 12px; align-items: center; padding: 8px 12px; }
.el-compact-head { color: var(--el-label-2); font-size: 12px; background: var(--el-bg-l2); border-radius: 8px 8px 0 0; }
.el-compact-row { min-height: 49px; border-top: 1px solid var(--el-border-l1); cursor: pointer; } .el-compact-row:hover { background: var(--el-bg-l2); }
.el-compact-row>* { min-width: 0; } .el-compact-row .el-result>.el-clip { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 18px; }
.el-col-name { min-width: 0; } .el-inline-branch { display: none; color: var(--el-label-2); font: 11px/16px var(--el-font-code); } .el-session-static { display: block; min-width: 0; max-width: 100%; color: var(--el-label-2); }
@container (max-width: 1049px) { .el-compact-head, .el-compact-row { grid-template-columns: minmax(160px, 1.7fr) minmax(100px, 1fr) minmax(150px, 1.4fr) 64px 88px 32px; gap: 10px; } .el-col-updated { display: none; } .el-col-session .el-link>.el-clip { display: none; } .el-col-session .el-narrow-session { display: inline; } .el-col-session .el-link>svg { display: none; } }
@container (max-width: 849px) { .el-compact-head, .el-compact-row { grid-template-columns: minmax(170px, 1.7fr) minmax(150px, 1.4fr) 64px 88px 32px; gap: 8px; padding: 6px 10px; } .el-col-branch { display: none; } .el-inline-branch { display: block; } .el-compact-scroll { padding-inline: 16px; } }
.el-menu-layer { position: fixed; z-index: 4000; height: auto; padding: 0; background: transparent; min-width: 224px; max-width: min(400px, calc(100vw - 16px)); }
.el-menu-layer [role=menu] { background: var(--el-bg-l1); border: 1px solid var(--el-border-l1); box-shadow: 0 8px 24px var(--el-shadow); border-radius: 8px; padding: 6px; max-height: min(420px, calc(100vh - 24px)); overflow: auto; }
.el-menu-layer button[role^=menuitem] { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; width: 100%; border: 0; background: transparent; padding: 7px 10px; text-align: left; font-size: 13px; }
.el-menu-layer button[role^=menuitem]:hover, .el-menu-layer button[role^=menuitem]:focus-visible { background: var(--el-bg-l2); } .el-menu-layer button small { flex: 0 0 100%; color: var(--el-label-2); overflow-wrap: anywhere; }
.el-menu-layer hr { border: 0; border-top: 1px solid var(--el-border-l1); margin: 4px; } .el-menu-layer input { width: 100%; margin-bottom: 6px; }
.el-dialog-mask { position: fixed; inset: 0; width: 100%; height: 100%; padding: 16px; z-index: 5000; background: var(--el-bg-overlay); display: flex; align-items: center; justify-content: center; }
.el-dialog { width: min(560px, 100%); max-height: calc(100vh - 32px); overflow: auto; display: flex; flex-direction: column; gap: 16px; background: var(--el-bg-l1); border: 1px solid var(--el-border-l1); border-radius: 12px; padding: 20px; box-shadow: 0 12px 36px var(--el-shadow); }
.el-wide-dialog { width: min(960px, 100%); } .el-dialog>header { display: flex; align-items: center; justify-content: space-between; gap: 16px; } .el-dialog>header h2 { margin: 0; }
.el-dialog label { display: flex; gap: 8px; align-items: center; } .el-dialog label:has(textarea), .el-dialog label:has(input:not([type=checkbox])) { flex-direction: column; align-items: stretch; }
.el-dialog textarea { display: block; width: 100%; min-height: 200px; resize: vertical; font: 13px/1.7 var(--el-font-code); } .el-dialog p, .el-dialog small { color: var(--el-label-2); }
.el-dialog footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 0; } .el-setting-row { display: flex; justify-content: space-between; gap: 16px; } .el-setting-row>span:first-child { display: flex; flex-direction: column; } .el-setting-field { display: flex; flex-direction: column; }
.el-file-button { display: inline-flex!important; justify-content: center; align-items: center; position: relative; cursor: pointer; font-size: 13px; } .el-file-button input[type=file] { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; } .el-file-button:focus-within { outline: 2px solid var(--el-brand); }
.el-extension-tools { display: flex; align-items: center; gap: 8px; } .el-extension-tools>span:last-child { margin-left: auto; } .el-extension-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; min-height: 280px; } .el-extension-columns>section { overflow: auto; padding: 12px; border: 1px solid var(--el-border-l1); border-radius: 6px; max-height: 55vh; } .el-extension-columns textarea { height: 100%; min-height: 280px; }
.el-review { display: flex; flex-direction: column; min-height: 0; min-width: 0; flex: 1; }
.el-review-heading { display: flex; gap: 12px; align-items: center; padding: 12px 16px; background: var(--el-bg-l1); min-height: 76px; }
.el-review-heading>button:first-child { flex-shrink: 0; white-space: nowrap; }
.el-review-title { min-width: 0; } .el-review-title h2 { font-size: 16px; } .el-review-title p { color: var(--el-label-2); font-size: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.el-review-title .el-menu-trigger { min-height: 26px; font-size: 12px; padding: 1px 6px; } .el-review-heading>.el-primary { flex-shrink: 0; }
.el-history-notice, .el-review-notice { padding: 6px 12px; color: var(--el-label-2); background: var(--el-bg-l1); border-top: 1px solid var(--el-border-l1); font-size: 13px; }
.el-review-toolbar { display: flex; align-items: center; gap: 8px; height: 40px; flex: 0 0 40px; padding: 0 16px; background: var(--el-bg-l1); border-bottom: 1px solid var(--el-border-l1); flex-wrap: nowrap; overflow-x: auto; }
.el-view-switch { display: inline-flex; flex-shrink: 0; gap: 2px; height: 32px; padding: 2px; border-radius: 7px; background: var(--el-hover); } .el-plugin .el-view-switch button { min-height: 28px; height: 28px; padding: 0 10px; border: 0; border-radius: 5px; background: transparent; color: var(--el-label-2); font-size: 12px; line-height: 28px; white-space: nowrap; }
.el-plugin .el-view-switch button[aria-pressed=true] { background: var(--el-bg-l2); color: var(--el-brand-link); font-weight: 600; }
.el-review-body { display: flex; min-height: 0; min-width: 0; flex: 1; overflow: hidden; }
.el-file-tree { flex: 0 0 auto; min-width: 180px; max-width: 45%; background: var(--el-bg-l1); padding: 12px 8px; overflow: auto; }
.el-file-tree .el-search { width: 100%; margin-bottom: 12px; } .el-plugin .el-tree-file { display: flex; justify-content: flex-start; gap: 6px; border: 0; background: transparent; border-radius: 5px; min-height: 32px; padding: 4px 6px; width: 100%; font: 12px/1.6 var(--el-font-code); }
.el-tree-file svg { flex-shrink: 0; color: var(--el-label-2); } .el-plugin .el-tree-selected { background: var(--el-brand-tint); color: var(--el-brand-link); } .el-plugin .el-tree-weak { background: var(--el-bg-l2); }
.el-risk-dot, .el-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; flex: 0 0 6px; background: var(--el-state-error); margin-left: auto; } .el-dot { margin: 0 6px 2px 0; background: var(--el-label-3); }
.el-tree-resizer { width: 1px; flex: 0 0 1px; background: var(--el-border-l1); position: relative; cursor: col-resize; z-index: 1; } .el-tree-resizer::after { position: absolute; content: ''; inset: 0 -3px; }
.el-overview { overflow: auto; padding: 12px 12px 32px; width: 100%; max-width: 1104px; min-width: 0; }
.el-overview>section, .el-overview>details { margin-bottom: 24px; } .el-overview h2 { margin-bottom: 12px; } .el-overview h3 { margin: 12px 0 8px; } .el-overview ul { padding-left: 20px; margin: 8px 0; }
.el-hero { background: var(--el-bg-l1); border: 1px solid var(--el-border-l1); border-radius: 8px; padding: 16px; } .el-basis { color: var(--el-label-3); font-size: 11px; font-weight: 400; border: 1px dotted var(--el-border-l1); border-radius: 3px; padding: 1px 5px; vertical-align: middle; margin-left: 6px; }
.el-stat-pills { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; } .panel-status { background: var(--el-bg-l2); border: 1px solid var(--el-border-l1); border-left: 3px solid var(--el-label-3); padding: 8px 12px; border-radius: 6px; }
.el-change-list li { margin: 8px 0; line-height: 1.8; } .el-change-list small { font-size: 12px; white-space: nowrap; } .el-feature { border: 1px solid var(--el-border-l1); border-radius: 8px; background: var(--el-bg-l1); padding: 16px; margin-bottom: 12px; } .el-feature>h3:first-child { margin-top: 0; }
.el-plugin summary { cursor: pointer; color: var(--el-label-2); padding: 6px 0; } .el-refs { display: inline-flex; flex-wrap: wrap; gap: 8px; font: 12px/1.7 var(--el-font-code); margin: 4px 0; }
.el-alignment { border-left: 2px solid var(--el-border-l1); padding: 8px 12px; margin: 8px 0; } .el-alignment-group { margin-bottom: 12px; } .el-section-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; } .el-section-heading>div { display: flex; gap: 4px; }
.el-plugin .el-section-heading [role=group] button { min-height: 28px; padding: 0 8px; border: 0; background: transparent; color: var(--el-label-2); font-size: 12px; }
.el-plugin .el-section-heading [role=group] button[aria-pressed=true], .el-plugin .el-section-heading [role=group] button:hover { color: var(--el-brand-link); background: var(--el-hover); }
.overview-problem-group { padding-left: 12px; border-left: 3px solid var(--el-state-error); margin: 12px 0; } .overview-problem-group[data-severity=P2] { border-color: var(--el-state-warn); } .overview-problem-group ul { list-style: none; padding-left: 0; }
.el-plugin .el-problem-link { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; border: 0; background: transparent; padding: 6px 0; width: 100%; justify-content: flex-start; text-align: left; } .el-problem-link>span:first-child { color: var(--el-state-error); } .el-problem-link[data-severity=P2]>span:first-child { color: var(--el-state-warn); } .el-problem-link small { color: var(--el-label-2); }
.el-withheld { color: var(--el-state-warn); background: var(--el-bg-l1); padding: 12px; border: 1px solid var(--el-border-l1); border-radius: 6px; } .overview-requirements { border-top: 1px solid var(--el-border-l1); padding-top: 12px; } .overview-requirements>summary { color: var(--el-label-1); font-weight: 650; } .overview-requirements article { padding: 8px 0; }
.el-prose { min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap; } .el-prose p+p { margin-top: 8px; } .el-plugin pre { white-space: pre; overflow: auto; font: 13px/1.6 var(--el-font-code); max-width: 100%; } .el-prose pre { padding: 12px; background: var(--el-bg-l2); border: 1px solid var(--el-border-l1); border-radius: 6px; } .el-plugin code { font-family: var(--el-font-code); }
.el-diff-pane { display: flex; flex: 1; min-width: 0; min-height: 0; flex-direction: column; position: relative; background: var(--el-bg-l1); }
.el-file-heading { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 8px 12px; border-bottom: 1px solid var(--el-border-l1); flex-wrap: wrap; font-size: 12px; }
.el-file-heading strong { overflow-wrap: anywhere; } .el-diff-scroll { overflow: auto; min-height: 0; flex: 1; }
.el-diff-rendered { min-width: 0; } .el-diff-rendered .d2h-file-header { display: none; } .el-diff-rendered .d2h-file-wrapper { border: 0; margin: 0; } .el-diff-rendered .d2h-code-line-ctn { font: 13px/20px var(--el-font-diff); } .el-diff-rendered .d2h-code-linenumber, .el-diff-rendered .d2h-code-side-linenumber { position: relative; }
.el-diff-rendered .el-diff-insert>td { padding: 0; border: 0; background: var(--el-bg-l1); } .el-inline-stack { min-width: 0; white-space: normal; padding: 4px 8px; } .el-inline-stack:empty { padding: 0; }
.el-file-fallback:not(:empty) { padding: 12px; border-bottom: 1px solid var(--el-border-l1); } .el-file-fallback>section { margin-bottom: 12px; } .el-frozen-context { padding: 8px; background: var(--el-bg-l2); border: 1px solid var(--el-border-l1); } .el-frozen-context span { color: var(--el-label-3); } .el-frozen-context [data-anchor=true] { background: var(--el-brand-tint); }
.el-line-add-slot { position: absolute; right: 0; top: 0; opacity: 0; } tr:hover .el-line-add-slot, .el-line-add-slot:focus-within { opacity: 1; } .el-plugin .annotation-add-btn { min-height: 20px; height: 20px; width: 20px; padding: 0; color: var(--el-label-2); background: var(--el-bg-l1); }
.el-issue-card { border: 1px solid var(--el-border-l1); border-left: 3px solid var(--el-state-error); border-radius: 8px; background: var(--el-bg-l1); overflow: hidden; margin: 4px 0; min-width: 0; color: var(--el-label-1); font: 14px/1.65 system-ui, sans-serif; }
.el-issue-card[data-severity=P2] { border-left-color: var(--el-state-warn); } .el-issue-card>header { display: flex; align-items: flex-start; gap: 8px; padding: 8px 12px; background: var(--el-bg-l2); }
.el-plugin .el-issue-toggle { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 8px; flex: 1; min-width: 0; min-height: 24px; border: 0; border-radius: 0; background: transparent; padding: 0; text-align: left; }
.el-issue-toggle strong { min-width: 80px; overflow-wrap: anywhere; flex: 1; } .el-category { font-size: 11px; border-radius: 4px; background: var(--el-border-l1); padding: 0 5px; color: var(--el-label-2); } .el-severity { color: var(--el-state-error); font-size: 12px; font-weight: 650; } [data-severity=P2] .el-severity { color: var(--el-state-warn); }
.el-issue-actions { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; justify-content: flex-end; } .el-plugin .el-issue-actions .el-icon-button { flex-basis: 24px; min-height: 24px; width: 24px; height: 24px; border: 0; background: transparent; }
.el-plugin .el-issue-actions .el-icon-button { border-radius: 4px; }
.el-plugin .el-issue-actions .issue-card-comment:hover { color: var(--el-label-1); background: var(--el-hover); }
.el-plugin .el-issue-actions .issue-card-ask:hover, .el-plugin .el-issue-actions .el-next-issue:hover { color: var(--el-brand); background: var(--el-brand-tint); }
.el-plugin .el-issue-actions .issue-card-suppress:hover { color: var(--el-state-error); background: var(--el-state-error-tint); }
.el-plugin .el-issue-actions .el-restore-link { height: 24px; min-height: 24px; padding: 0 6px; border: 0; border-radius: 4px; background: transparent; color: var(--el-brand-link); font-size: 12px; }
.el-plugin .el-issue-actions .el-restore-link:hover { background: var(--el-hover); } .el-issue-content { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; } .el-issue-content>div { display: flex; align-items: flex-start; } .el-issue-content>div>strong { flex-shrink: 0; }
.el-suggestion { border-top: 1px dashed var(--el-border-l1); padding-top: 10px; } .el-suggestion>strong { display: block; margin-bottom: 6px; } .el-suggestion details { margin-top: 8px; border: 1px solid var(--el-border-l1); border-radius: 6px; background: var(--el-bg-l2); } .el-suggestion summary { padding: 5px 10px; font-size: 12px; } .el-suggestion pre { padding: 8px 12px; margin: 0; } .el-code-actions { display: flex; justify-content: flex-end; padding: 0 8px; } .el-code-actions button { font-size: 12px; }
.el-issue-card.el-suppressed { border-left-color: var(--el-label-3); } .el-suppressed .el-severity { color: var(--el-label-2); } .el-issue-toggle small { color: var(--el-label-2); font-size: 12px; }
.annotation-editor { padding: 12px; background: var(--el-bg-l1); border: 1px solid var(--el-border-l1); border-radius: 6px; margin: 8px 0; color: var(--el-label-1); font: 13px/1.6 system-ui, sans-serif; } .annotation-editor h4 { margin: 0 0 8px; }
.annotation-editor__input { display: block; width: 100%; min-height: 90px; max-height: 35vh; resize: vertical; }
.annotation-editor .annotation-editor__error { min-height: 0; margin: 0; color: var(--el-state-error); font-size: 12px; line-height: 1.4; }
.annotation-editor .annotation-editor__error:empty { display: none; } .annotation-editor .annotation-editor__error:not(:empty) { margin-top: 6px; }
.annotation-editor__actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; margin-top: 8px; } .annotation-editor__actions small { margin-right: auto; color: var(--el-label-2); font-size: 11px; } .annotation-editor .annotation-editor__error:not(:empty)+.annotation-editor__actions { margin-top: 6px; }
.el-annotation-card { border: 1px solid var(--el-border-l1); border-radius: 6px; background: var(--el-bg-l2); padding: 12px; margin: 8px 0; color: var(--el-label-1); font: 13px/1.6 system-ui, sans-serif; } .el-annotation-card header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; } .el-annotation-card small { color: var(--el-label-2); } .el-plugin .el-annotation-card header button { min-height: 24px; padding: 1px 6px; border: 0; background: transparent; color: var(--el-label-3); font-size: 12px; } .el-plugin .el-annotation-card header button:hover { color: var(--el-brand-link); }
.el-file-explanation { flex: 0 0 auto; resize: vertical; overflow: auto; height: 180px; min-height: 80px; max-height: 50vh; padding: 12px 16px; border-top: 1px solid var(--el-border-l1); background: var(--el-bg-l1); } .el-file-explanation h3 { margin: 0 0 8px; } .el-file-explanation ul { margin: 0 0 12px; padding-left: 20px; } .el-file-explanation .el-summary-link { color: var(--el-label-2); } .el-file-explanation .el-summary-link:hover { color: var(--el-brand-link); }
.el-undo { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-top: 1px solid var(--el-border-l1); background: var(--el-bg-l1); }
.el-issue-pulse { animation: el-pulse 1.6s ease-out; } @keyframes el-pulse { 0%, 40% { box-shadow: 0 0 0 2px var(--el-brand); } 100% { box-shadow: 0 0 0 0 transparent; } }
@media (max-width: 720px) { .el-page-header { padding: 12px 16px; } .el-page-header>.el-search { flex: 1; min-width: 180px; } .el-list-controls { padding-inline: 16px; } .el-card-scroll { padding-inline: 16px; } .el-extension-columns { grid-template-columns: 1fr; } .el-extension-columns>section { max-height: 220px; } .el-issue-card>header { flex-wrap: wrap; } .el-issue-actions { margin-left: auto; } .el-issue-content { padding: 10px 12px; } }
@media (hover:none) { .el-link-arrow { opacity: 1; transform: none; } .el-line-add-slot { opacity: 1; } }
@media (prefers-reduced-motion:reduce) { .el-plugin *, .el-plugin *::before, .el-plugin *::after { scroll-behavior: auto!important; animation: none!important; transition: none!important; } .el-link-arrow { transform: none; } }
.el-material-icon { width: 16px; height: 16px; flex: 0 0 16px; object-fit: contain; }
.el-plugin .el-tree-folder { border: 0; background: transparent; display: flex; justify-content: flex-start; gap: 5px; width: 100%; padding: 4px 6px; font-size: 12px; }
.el-tree-level { min-width: 0; } .el-tree-children { padding-left: 12px; }
.el-tail-card { background: var(--el-bg-l1); border: 1px solid var(--el-border-l1); border-radius: 8px; display: flex; align-items: center; gap: 12px; padding: 12px; height: auto; font-size: 13px; }
.el-tail-card>div { flex: 1; } .el-tail-card .el-primary { white-space: nowrap; }
/* Signed-off prototype interaction: line wrapping, persistent toolbar geometry, anchored settings. */
.el-invisible { visibility: hidden; pointer-events: none; }
.el-file-filter { display: inline-flex; flex-shrink: 0; gap: 0; height: 32px; padding: 2px; border: 0; border-radius: 8px; background: var(--el-bg-l3); box-shadow: inset 0 0 0 1px var(--el-border-l1); font-size: 12px; }
.el-file-filter label { display: inline-flex; align-items: center; cursor: pointer; }
.el-file-filter input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.el-file-filter-option { display: inline-flex; align-items: center; height: 28px; padding: 4px 10px; border: 0; border-radius: 6px; background: transparent; color: var(--el-label-2); }
.el-file-filter label:hover>.el-file-filter-option { background: var(--el-hover); }
.el-file-filter input:checked+.el-file-filter-option { color: var(--el-label-1); background: var(--el-bg-l2); box-shadow: var(--el-shadow-card); }
.el-file-filter input:focus-visible+.el-file-filter-option { outline: 2px solid var(--el-brand); outline-offset: -2px; }
.el-file-filter-label { font-size: 13px; font-weight: 500; padding-right: 4px; }
.el-file-filter-label--all { color: var(--el-label-1); }
.el-file-filter-label--risk { color: var(--el-state-error); }
.el-file-filter-count { display: inline-flex; align-items: center; padding: 0 6px; border-radius: 999px; font-size: 12px; font-weight: 500; line-height: 20px; }
.el-file-filter-count--all, .el-file-filter-count--changed { background: var(--el-hover); color: var(--el-label-2); }
.el-file-filter-count--risk { background: var(--el-state-error-tint); color: var(--el-state-error); }
body[data-ds-dark-theme] .el-plugin { --el-state-error-tint: rgba(248, 81, 73, .14); }
.el-diff-rendered .d2h-code-line-ctn { white-space: break-spaces; overflow-wrap: anywhere; word-break: break-word; line-break: anywhere; font: 13px/20px var(--el-font-diff); }
.el-diff-rendered .d2h-code-line, .el-diff-rendered .d2h-code-side-line { width: 100%; padding: 0 8px; line-height: 20px; }
.el-diff-unified .d2h-code-line-ctn { display: inline-block; max-width: calc(100% - 18px); vertical-align: top; }
.el-diff-split .d2h-files-diff { display: flex; width: 100%; }
.el-diff-split .d2h-file-side-diff { width: 50%; min-width: 0; overflow-x: hidden; overflow-y: visible; }
.el-diff-split .d2h-file-side-diff+.d2h-file-side-diff { border-left: 1px solid var(--el-border-l1); }
.el-diff-split .d2h-code-side-line { display: flex; align-items: flex-start; gap: 6px; }
.el-diff-split .d2h-code-line-prefix { flex: 0 0 auto; }
.el-diff-split .d2h-code-line-ctn { flex: 1; min-width: 0; }
.el-diff-rendered ins, .el-diff-rendered del { white-space: inherit; }
.el-settings-popover { position: fixed; z-index: 4000; width: 360px; max-width: calc(100vw - 16px); height: auto; max-height: calc(100vh - 24px); overflow: auto; padding: 16px; gap: 16px; background: var(--el-bg-l1); border: 1px solid var(--el-border-l1); border-radius: 10px; box-shadow: 0 8px 24px var(--el-shadow); font-size: 13px; }
.el-settings-popover h2 { font-size: 15px; } .el-settings-popover small { display: block; color: var(--el-label-2); font-size: 12px; } .el-settings-popover .el-setting-field { gap: 6px; } .el-settings-popover .el-setting-row { align-items: center; }
.el-diff-rendered .d2h-diff-table { table-layout: fixed; width: 100%; margin: 0; font-size: 13px; }
.el-diff-rendered td, .el-diff-rendered th { border: 0; padding: 0; vertical-align: top; }
.el-diff-rendered td.d2h-code-linenumber { position: relative; display: table-cell; width: 7.5em; min-width: 7.5em; font: 12px/20px var(--el-font-diff); color: var(--el-label-3); }
.el-diff-rendered td.d2h-code-side-linenumber { position: relative; display: table-cell; width: 40px; min-width: 40px; font: 12px/20px var(--el-font-diff); color: var(--el-label-3); }
.el-file-heading { min-height: 40px; padding: 0 12px; flex-wrap: nowrap; }
.el-change-badge { flex: 0 0 auto; padding: 0 5px; background: var(--el-bg-l2); color: var(--el-label-2); font-size: 12px; line-height: 20px; border-radius: 4px; }
.el-plugin .el-file-name { min-height: 0; min-width: 0; max-width: min(60%, 720px); flex: 0 1 auto; border: 0; padding: 0; background: transparent; font: 13px/20px var(--el-font-code); font-weight: 500; color: var(--el-label-1); text-align: left; }
.el-file-name>span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.el-plugin button.el-file-name:hover { color: var(--el-brand-link); text-decoration: underline; background: transparent; }
.el-file-stats { display: inline-flex; gap: 6px; flex-shrink: 0; font: 12px/20px var(--el-font-code); }
.el-file-stats>span:first-child { color: var(--el-state-success); } .el-file-stats>span:last-child { color: var(--el-state-error); }
.el-plugin .el-status-link { border: 0; background: transparent; color: var(--el-label-2); font-size: 12px; padding-inline: 4px; }

.el-diff-rendered .d2h-code-line-prefix { font-family: var(--el-font-diff); font-variant-ligatures: none; }

.el-anchored-mask { background: transparent; }
.el-anchored-mask .el-dialog { padding: 14px; gap: 12px; }
.el-anchored-mask .el-dialog h2 { font-size: 14px; }
.el-plugin .el-suggestion--code { border: 1px solid var(--el-border-l1); border-radius: 8px; padding: 0; overflow: hidden; }
.el-suggestion-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; background: var(--el-bg-l2); }
.el-plugin .el-suggestion-toggle { justify-content: flex-start; border: 0; padding: 6px 10px; min-width: 0; background: transparent; font-size: 12px; font-weight: 600; }
.el-suggestion-body { padding: 10px 12px; border-top: 1px solid var(--el-border-l1); }
.el-suggestion-body pre { padding: 8px 0 0; }

.el-file-suppressed-bar { padding: 4px 12px; background: var(--el-bg-l1); border-bottom: 1px solid var(--el-border-l1); }
.el-plugin .el-file-suppressed-chip { gap: 5px; min-height: 24px; height: 24px; padding: 0 8px; border: 1px solid var(--el-border-l1); border-radius: 4px; font-size: 12px; color: var(--el-label-2); background: var(--el-hover); }
.el-plugin .el-file-suppressed-chip[aria-expanded=true] { background: var(--el-brand-tint); color: var(--el-brand-link); border-color: var(--el-brand-ring); }
.el-suppressed-slot { position: absolute; left: 3px; top: 50%; transform: translateY(-50%); display: inline-flex; gap: 2px; max-width: calc(100% - 6px); overflow-x: auto; scrollbar-width: none; }
.el-plugin .el-suppressed-marker { flex: 0 0 auto; width: 24px; height: 24px; min-height: 24px; padding: 0; border: 0; border-radius: 3px; color: var(--el-brand); background: transparent; }
.el-plugin .el-suppressed-slot:has(.el-suppressed-marker:nth-child(2)) .el-suppressed-marker { width: 16px; height: 16px; min-height: 16px; }
.el-plugin .el-suppressed-marker[aria-expanded=true] { color: var(--el-brand); background: var(--el-hover); }
.el-plugin .el-suppressed-marker:hover { color: var(--el-brand); background: var(--el-hover); }
.el-diff-rendered td:has(.el-suppressed-slot) .el-line-add-slot { display: none; }

/* Host blue: small text is distinct from graphic/focus blue. Neutral hunk headers are deliberate. */
.el-plugin input:not([type=checkbox]):focus, .el-plugin textarea:focus { border-color: var(--el-brand); box-shadow: 0 0 0 2px var(--el-brand-ring); outline: none; }
.el-plugin input:not([type=checkbox]):focus-visible, .el-plugin textarea:focus-visible { outline: none; }
.el-file-button:focus-within { outline-offset: -2px; }
.el-plugin .el-file-explanation .el-summary-link { color: var(--el-brand-link); }
.el-plugin .d2h-wrapper .d2h-info { background-color: var(--el-bg-l3); border-color: var(--el-border-l1); color: var(--el-label-3); cursor: default; }
`;

// plugin/client/index.tsx
var name = "dsh-evidentloop";
var inject = [
  "connection",
  "slots",
  "layout",
  "uiSession",
  "uiWorkspace"
];
function apply(ctx) {
  const runtime = new ClientRuntime(new NativeClient(ctx));
  const link = document.createElement("style");
  link.dataset.pluginCss = "dsh-evidentloop";
  link.textContent = styles_default;
  document.head.append(link);
  ctx.slots.inject(
    "main",
    () => ctx.slots.register({ name: "main", key: "dsh-evidentloop" }, () => /* @__PURE__ */ import_react8.default.createElement(Panel, { runtime }))
  );
  ctx.slots.inject(
    "sidebar.panellist",
    () => ctx.slots.register(
      {
        name: "sidebar.panellist",
        id: "dsh-evidentloop",
        label: "\u53D8\u66F4\u8BC4\u5BA1",
        order: 20
      },
      ({ size = 16 }) => /* @__PURE__ */ import_react8.default.createElement(Icon, { name: "brand", size })
    )
  );
  ctx.slots.inject(
    "conversation.chat.turnTail",
    () => ctx.slots.register(
      { name: "conversation.chat.turnTail", id: "dsh-evidentloop" },
      (props) => /* @__PURE__ */ import_react8.default.createElement(DeliveryTail, { ...props, runtime })
    )
  );
  const diffCss = document.createElement("link");
  diffCss.rel = "stylesheet";
  diffCss.href = "/api/dsh-evidentloop/assets/diff.css";
  document.head.append(diffCss);
  runtime.start();
  ctx.effect(() => () => {
    runtime.stop();
    link.remove();
    diffCss.remove();
  });
}
function DeliveryTail({
  runtime,
  sessionId
}) {
  const [context, setContext] = import_react8.default.useState(null), [error, setError] = import_react8.default.useState(""), [busy, setBusy] = import_react8.default.useState(false);
  import_react8.default.useEffect(() => {
    let live = true;
    if (typeof sessionId !== "string") return;
    runtime.sessionContext(sessionId).then((c) => {
      if (live) setContext(c);
    }).catch((e) => {
      if (live) setError(errorMessage(e));
    });
    return () => {
      live = false;
    };
  }, [sessionId]);
  if (!context?.available) return null;
  return /* @__PURE__ */ import_react8.default.createElement("section", { className: "el-plugin el-tail-card" }, /* @__PURE__ */ import_react8.default.createElement(Icon, { name: "brand", size: 24 }), /* @__PURE__ */ import_react8.default.createElement("div", null, /* @__PURE__ */ import_react8.default.createElement("p", null, context.statusText), /* @__PURE__ */ import_react8.default.createElement("small", null, "\u5BA1\u67E5\u5F53\u524D\u5DE5\u4F5C\u533A\u7684\u7D2F\u8BA1\u6539\u52A8"), error && /* @__PURE__ */ import_react8.default.createElement("p", { role: "alert" }, error)), /* @__PURE__ */ import_react8.default.createElement(
    "button",
    {
      className: "el-primary",
      disabled: busy,
      onClick: async () => {
        setBusy(true);
        try {
          await runtime.openFromSession(sessionId);
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setBusy(false);
        }
      }
    },
    busy ? "\u6B63\u5728\u51BB\u7ED3" : "\u5BA1\u67E5\u672C\u6B21\u53D8\u66F4"
  ));
}

return module.exports;}});
