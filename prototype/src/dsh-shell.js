/* DSH Desktop shell mock: sidebar + conversation with the delivery-area card. */
(function () {
  'use strict';
  const P = window.CRPrototype = window.CRPrototype || {};
  P.icons.deepseek = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 13.5c2.2-4.2 5-6.3 7.5-6.3 2.1 0 3.7 1.2 4.7 3.2 1.1-.5 2-.6 2.8-.4-.7 1-1 2-1 3.2 0 3.4-2.7 5.8-6.5 5.8-4.1 0-7.3-2.1-7.5-5.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="14.4" cy="12.4" r="1" fill="currentColor"/></svg>';

  P.DshSidebar = {
    props: {
      view: { type: String, default: 'conversation' },
      projectName: { type: String, default: 'dsh-evidentloop' },
      workspaces: { type: Array, default: () => [] },
      currentWorkspaceId: { type: String, default: '' },
      sessions: { type: Array, default: () => [] },
      conversationTitle: { type: String, default: '接入 EvidentLoop 变更评审' },
      conversationTime: { type: String, default: '1 小时前' },
    },
    emits: ['open-list', 'open-conversation'],
    computed: {
      icons() { return P.icons; },
      currentSessions() {
        const workspace = (this.workspaces || []).find(entry => entry.workspaceId === this.currentWorkspaceId);
        const repoKey = workspace?.repoKey || '';
        if (!repoKey) return [];
        return (this.sessions || [])
          .filter(session => session.projectKey === repoKey && !session.parentSessionId && session.kind === 'dev')
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      },
    },
    methods: {
      timeOf(value) { return P.formatRelative(value); },
    },
    template: `
      <aside class="dsh-sidebar" aria-label="DSH Desktop 侧栏">
        <div class="dsh-traffic">
          <span class="dsh-light dsh-light--red"></span>
          <span class="dsh-light dsh-light--yellow"></span>
          <span class="dsh-light dsh-light--green"></span>
          <button class="dsh-side-collapse" type="button" aria-label="收起侧栏" v-tip="'收起侧栏'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>
          </button>
        </div>
        <div class="dsh-brand">
          <span class="dsh-brand-mark" v-html="icons.deepseek"></span>
          <span class="dsh-brand-word">deepseek <b>HARNESS</b></span>
        </div>
        <button class="dsh-new-chat" type="button">＋ 新会话</button>
        <nav class="dsh-nav" aria-label="DSH 导航">
          <button class="dsh-nav-item" type="button">
            <span class="dsh-nav-icon" v-html="icons.plug"></span>
            <span>插件</span>
          </button>
          <button class="dsh-nav-item dsh-nav-item--plugin" :class="{ 'is-active': view === 'review' || view === 'list' }" type="button" @click="$emit('open-list')">
            <span class="dsh-nav-icon" v-html="icons.evidentloopLine"></span>
            <span>变更评审</span>
            <span class="dsh-nav-dot" aria-hidden="true"></span>
          </button>
          <button class="dsh-nav-item" type="button">
            <span class="dsh-nav-icon" v-html="icons.auto"></span>
            <span>自动化任务</span>
          </button>
          <button class="dsh-nav-item" type="button">
            <span class="dsh-nav-icon" v-html="icons.layers"></span>
            <span>上下文洞察</span>
          </button>
          <button class="dsh-nav-item" type="button">
            <span class="dsh-nav-icon" v-html="icons.more"></span>
            <span>更多</span>
          </button>
        </nav>
        <div class="dsh-workspace">
          <div class="dsh-workspace-head">
            <span>工作区</span>
            <span class="dsh-workspace-tools" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M4 12h10M4 17h7"/></svg>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5h6v14H4zM14 5h6v14h-6z"/></svg>
            </span>
          </div>
          <div v-for="workspace in workspaces" :key="workspace.workspaceId" class="dsh-workspace-group">
            <button class="dsh-project-row dsh-project-row--workspace" :class="{ 'is-current': workspace.workspaceId === currentWorkspaceId }" type="button" :aria-current="workspace.workspaceId === currentWorkspaceId ? 'true' : undefined">
              <span class="dsh-nav-icon" v-html="icons.folder"></span>{{ workspace.name }}
            </button>
            <template v-if="workspace.workspaceId === currentWorkspaceId">
              <button v-for="session in currentSessions" :key="session.sessionId" class="dsh-chat-row" :class="{ 'is-active': view === 'conversation' && conversationTitle === session.title }" type="button" @click="$emit('open-conversation')">
                <span class="dsh-chat-row-title">{{ session.title }}</span>
                <span class="dsh-chat-row-time">{{ timeOf(session.updatedAt) }}</span>
              </button>
            </template>
          </div>
        </div>
        <div class="dsh-user">
          <span class="dsh-avatar" aria-hidden="true">秋</span>
          <span class="dsh-user-name">秋日拾遗 <small>≡<sup>NG</sup></small></span>
          <span class="dsh-user-more" v-html="icons.more"></span>
        </div>
      </aside>
    `,
  };

  P.DshConversation = {
    props: {
      card: { type: Object, default: () => null },
      projectName: { type: String, default: 'dsh-evidentloop' },
      title: { type: String, default: '接入 EvidentLoop 变更评审' },
      draft: { type: String, default: '' },
    },
    emits: ['open-review', 'update:draft', 'send'],
    computed: {
      icons() { return P.icons; },
      currentSessions() {
        const workspace = (this.workspaces || []).find(entry => entry.workspaceId === this.currentWorkspaceId);
        const repoKey = workspace?.repoKey || '';
        if (!repoKey) return [];
        return (this.sessions || [])
          .filter(session => session.projectKey === repoKey && !session.parentSessionId && session.kind === 'dev')
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      },
    },
    methods: {
      timeOf(value) { return P.formatRelative(value); },
    },
    template: `
      <section class="dsh-conversation-view">
        <header class="dsh-chat-header">
          <div class="dsh-chat-title-row">
            <h1>{{ title }}</h1>
            <span class="dsh-mode-chip">标准模式</span>
            <span class="dsh-chat-header-spacer"></span>
            <span class="dsh-header-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 5h11v14H5V8"/><path d="M8 5v3H5"/></svg>
            </span>
            <span class="dsh-header-icon" aria-hidden="true" v-html="icons.dots"></span>
            <span class="dsh-header-icon" aria-hidden="true" v-html="icons.fullscreen"></span>
          </div>
          <nav class="dsh-chat-tabs" aria-label="对话视图">
            <span class="dsh-chat-tab is-active">对话</span>
            <span class="dsh-chat-tab">轨迹</span>
            <span class="dsh-chat-tab">上下文</span>
            <span class="dsh-chat-tab">编队</span>
            <span class="dsh-chat-tab dsh-chat-tab--more">…</span>
          </nav>
        </header>
        <div class="dsh-chat-body">
          <div class="dsh-msg dsh-msg--user">
            <div class="dsh-user-bubble">按 P1 brief 把评审台适配进 DSH：双入口、变更说明、需求依据、增量与运行状态都要能演示；只写 prototype/，不安装、不联网、不提交。</div>
          </div>
          <div class="dsh-assistant">
            <div class="dsh-assistant-mark" aria-hidden="true">E</div>
            <div class="dsh-msg-body">
              <p>演示已完成。评审台保留基线的文件树、Diff、问题卡片与处置交互，外壳换成 DSH Desktop：左侧入口先进入交付列表，下方交付卡片直接打开本次评审。</p>
              <p class="dsh-msg-note">数据来自本仓当前的 Git 改动，审查说明与问题为示例结果；大文件与第三方目录只留元数据。</p>
              <div v-if="card" class="dsh-delivery-card" role="group" aria-label="交付区卡片">
                <button class="dsh-delivery-card__main" type="button" @click="$emit('open-review')" aria-label="打开评审台">
                  <span class="dsh-delivery-icon" v-html="icons.evidentloopLine"></span>
                  <span class="dsh-delivery-main">
                    <span class="dsh-delivery-status" :class="'dsh-delivery-status--' + (card.statusTone || 'idle')">
                      <span class="dsh-delivery-status-dot" aria-hidden="true"></span>
                      <span>{{ card.status }}</span>
                    </span>
                    <span v-if="card.requirementLabel" class="dsh-delivery-sub dsh-delivery-requirement">{{ card.requirementLabel }}</span>
                  </span>
                </button>
                <button class="dsh-primary-btn" type="button" @click="$emit('open-review')">审查本次变更 <span v-html="icons.arrowRight"></span></button>
              </div>
              <div class="dsh-msg-tools">
                <span v-html="icons.copy"></span>
                <span class="dsh-msg-tools-meta">用量 130K tok · 13:23</span>
              </div>
            </div>
          </div>
        </div>
        <div class="dsh-composer-wrap">
          <div class="dsh-composer">
            <textarea class="dsh-composer-input" aria-label="会话输入框" :value="draft" placeholder="发消息或创建任务，/ 调用指令，@ 文件或对话" @input="$emit('update:draft', $event.target.value)"></textarea>
            <div class="dsh-composer-row">
              <button class="dsh-composer-plus" type="button" aria-label="添加">＋</button>
              <span class="dsh-composer-chip">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16v12H4z"/><path d="M8 10h8M8 14h5"/></svg>
                工作区内修改
              </span>
              <span class="dsh-composer-spacer"></span>
              <span class="dsh-model-chip">DeepSeek-V4.1-Flash Max</span>
              <button class="dsh-send" type="button" aria-label="发送" v-tip="'发送'" v-html="icons.send" @click="$emit('send')"></button>
            </div>
          </div>
          <div class="dsh-composer-status">1 轮 8 步 · 182 tok/s · 130K tok · 缓存命中 86% · 2%</div>
        </div>
      </section>
    `,
  };

  P.WorkspaceSettings = {
    props: {
      autoMode: { type: Boolean, default: false },
      targetBranch: { type: String, default: '' },
      exportEmbedDiff: { type: Boolean, default: false },
      extensionPrompt: { type: String, default: '' },
      sharedRepo: { type: Boolean, default: false },
      repoAvailable: { type: Boolean, default: true },
    },
    emits: ['update:autoMode', 'update:targetBranch', 'update:exportEmbedDiff', 'edit-extension'],
    computed: {
      extensionLength() { return P.codePointLength(this.extensionPrompt); },
    },
    template: `
      <div class="workspace-settings">
        <div class="wb-menu-title">工作区设置</div>
        <p class="workspace-settings-note">{{!repoAvailable ? '当前工作区不是 Git 仓库，设置仅暂存于此工作区' : sharedRepo ? '这些设置对同一仓库的所有工作区生效' : '这些设置对当前工作区所属仓库生效'}}</p>
        <label class="wb-setting-row"><span><b>自动审查</b><small>agent 每轮结束、代码有改动时自动审查</small></span><input type="checkbox" :checked="autoMode" @change="$emit('update:autoMode', $event.target.checked)"></label>
        <label class="wb-setting-row wb-setting-row--stack"><span><b>目标分支</b><small>留空自动检测；下次生成审查时使用，不改变当前Diff</small></span><input class="wb-input" type="text" :value="targetBranch" placeholder="自动检测" @input="$emit('update:targetBranch', $event.target.value)"></label>
        <div class="wb-setting-row wb-setting-row--links">
          <span><b>扩展提示词</b><small>{{ extensionLength ? '已配置 · ' + extensionLength + ' 字' : '未配置' }}</small></span>
          <span class="osw-setting-links"><button class="osw-text-link" type="button" @click="$emit('edit-extension')">编辑</button></span>
        </div>
        <label class="wb-setting-row"><span><b>HTML报告导出</b><small>HTML 报告默认嵌入完整 Diff</small></span><input type="checkbox" :checked="exportEmbedDiff" @change="$emit('update:exportEmbedDiff', $event.target.checked)"></label>
        <div class="wb-menu-foot"><span>仅在演示内存保存，刷新后恢复初始设置。</span><a class="wb-menu-foot-link" href="https://evidentloop.sanze.dev/guide.html" target="_blank" rel="noopener noreferrer">使用说明 ↗</a></div>
      </div>
    `,
  };

  // Controlled presentation components: the application still owns all delivery actions.
  P.DeliveryMenu = {
    props: ['delivery', 'meta', 'running', 'open'],
    emits: ['toggle', 'pin', 'archive', 'unarchive', 'delete'],
    computed: { icons() { return P.icons; } },
    template: `<span class="menu-anchor delivery-menu-anchor" @click.stop>
      <button class="delivery-more" type="button" :aria-label="'更多操作：'+delivery.title" v-tip="'更多操作：'+delivery.title" aria-haspopup="menu" :aria-expanded="String(open)" @click="$emit('toggle',delivery)" v-html="icons.dots"></button>
      <div v-if="open" class="wb-menu delivery-menu" role="menu" @click.stop>
        <button v-if="!meta.archived" class="wb-menu-item" type="button" role="menuitem" @click="$emit('pin',delivery)">{{meta.pinned ? '取消置顶' : '置顶'}}</button>
        <button v-if="!meta.archived" class="wb-menu-item" type="button" role="menuitem" :disabled="running" :title="running ? '审查进行中，完成后可归档' : undefined" @click="$emit('archive',delivery)">归档<small v-if="running">审查进行中，完成后可归档</small></button>
        <button v-else class="wb-menu-item" type="button" role="menuitem" @click="$emit('unarchive',delivery)">取消归档</button>
        <div class="wb-menu-sep"></div>
        <button class="wb-menu-item wb-menu-item--danger" type="button" role="menuitem" @click="$emit('delete',delivery)">删除</button>
      </div>
    </span>`,
  };
  P.DeliverySession = {
    props: ['entry'], emits: ['open'],
    computed: { icons() { return P.icons; }, stateLabel() { return this.entry?.state === 'archived' ? '已归档' : '不可用'; } },
    methods: { truncate(event) { P.updateTruncatedTitle(event, this.entry?.title || this.entry?.text || '', this.entry?.tip || ''); } },
    template: `<span v-if="entry && entry.state==='present'" class="delivery-session-slot">
      <button class="delivery-session-link delivery-inner-link" type="button" :aria-label="'最近会话：'+entry.text" @mouseenter="truncate" @focus="truncate" @click.stop="$emit('open')">
        <span class="delivery-session-icon" aria-hidden="true" v-html="icons.chat"></span><span class="delivery-session-title" data-truncate>{{entry.text}}</span><span class="delivery-session-short">会话</span><span class="delivery-session-time">· {{entry.time}}</span><span class="delivery-link-arrow" aria-hidden="true">→</span>
      </button>
    </span>
    <span v-else-if="entry" class="delivery-session-slot delivery-session-static" :aria-label="entry.title+'：会话'+stateLabel" :title="entry.tip || undefined" @mouseenter="truncate" @click.stop>
      <span class="delivery-session-icon" aria-hidden="true" v-html="icons.chat"></span><span class="delivery-session-title delivery-session-title--archived" data-truncate>{{entry.title}}</span><span class="delivery-session-suffix">（会话{{stateLabel}}）</span><span class="delivery-session-short">{{stateLabel}}</span><span class="delivery-session-time">· {{entry.time}}</span>
    </span>
    <span v-else class="delivery-session-slot delivery-session-empty" aria-label="无会话" @click.stop>—</span>`,
  };

})();
