/* =========================================================================
 * 反重力（Antigravity）中文增强补丁  ·  inject.js
 * -------------------------------------------------------------------------
 * 1) 顶栏模型额度小电池：Claude(橙) / GPT(白) / Gemini(紫) / 4Argon(蓝)，实时读取
 *    LanguageServerService.GetUserStatus 的 quotaInfo 与共享积分。
 *    Gemini 4 Argon 的周额度独立于普通 Gemini，单独一块电池；
 *    ID / 名称里带 argon 的模型归 4Argon，不参与 Gemini 的最低值计算。
 * 2) 基础汉化：字典 + 正则规则 + MutationObserver，只作用于界面外壳，
 *    绝不碰对话正文/代码/输入框内容。
 * 由 preload 通过 webFrame.executeJavaScript 注入主世界执行。
 * ========================================================================= */
(function () {
  'use strict';
  if (window.__AGYQ_LOADED__) return;
  window.__AGYQ_LOADED__ = true;

  /* ============================ 0. 基础工具 ============================ */
  const SKIP_SEL = [
    '[data-agyq-skip]',
    'code',
    'pre',
    'kbd',
    'textarea',
    '[contenteditable=""]',
    '[contenteditable="true"]',
    '.markdown',
    '.markdown-body',
    '.prose',
    '[data-testid="conversation-row-sidebar"]',
    '[data-testid="user-input-step"]',
    '[data-testid="turn-cards-container"]',
    '[data-testid="overview-panel-host"] [data-testid="artifact-preview"]',
  ].join(',');

  // 样式：由 preload 通过 window.__AGYQ_CSS__ 传入，避免依赖外部文件路径
  function ensureStyle() {
    const css = window.__AGYQ_CSS__;
    if (!css) return;
    let el = document.getElementById('agyq-style');
    if (el) el.remove();
    el = document.createElement('style');
    el.id = 'agyq-style';
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }
  if (document.head) ensureStyle();
  else document.addEventListener('DOMContentLoaded', ensureStyle, { once: true });

  const blocked = (el) => {
    if (!el || !el.closest) return true;
    return !!el.closest(SKIP_SEL);
  };

  /* ============================ 1. 汉化字典 ============================ */
  // 只收录界面外壳文案；模型名 / 参数档位（High、Medium…）保持原样。
  const DICT = {
    // ---- 顶部菜单栏 ----
    File: '文件',
    Edit: '编辑',
    View: '视图',
    Window: '窗口',
    Help: '帮助',
    'New Window': '新建窗口',
    'New Conversation': '新建对话',
    'Conversation History': '历史对话',
    Automations: '自动化',
    Customizations: '自定义',
    Projects: '项目',
    Conversations: '对话',
    Settings: '设置',
    'No more older messages': '没有更早的对话了',
    'Conversation Log': '对话日志',

    // ---- 侧栏 / 通用按钮 ----
    'Toggle Sidebar': '切换侧边栏',
    'Search Conversations': '搜索对话',
    Search: '搜索',
    'More actions': '更多操作',
    'Add project': '添加项目',
    'Add Project': '添加项目',
    'New Project': '新建项目',
    'No Project': '未选择项目',
    'Outside of Project': '项目之外',
    'Pinned': '已置顶',
    'Pin': '置顶',
    'Unpin': '取消置顶',
    'Archive': '归档',
    'Unarchive': '取消归档',
    'Rename': '重命名',
    'Delete': '删除',
    'Remove': '移除',
    'Copy': '复制',
    'Copied': '已复制',
    'Copy code': '复制代码',
    'Open': '打开',
    'Open Folder': '打开文件夹',
    'Open File': '打开文件',
    'Close': '关闭',
    'Cancel': '取消',
    'Confirm': '确认',
    'Save': '保存',
    'Done': '完成',
    'Back': '返回',
    'Next': '下一步',
    'Previous': '上一步',
    'Skip': '跳过',
    'Continue': '继续',
    'Retry': '重试',
    'Refresh': '刷新',
    'Submit': '提交',
    'Send': '发送',
    'Stop': '停止',
    'Dismiss': '忽略',
    'Allow': '允许',
    'Deny': '拒绝',
    'Approve': '批准',
    'Reject': '拒绝',
    'Always allow': '总是允许',
    'Ask every time': '每次询问',
    'Review': '查看变更',
    'Review changes': '查看变更',
    'Accept': '接受',
    'Accept all': '全部接受',
    'Undo': '撤销',
    'Redo': '重做',
    'Loading...': '加载中…',
    'Loading…': '加载中…',
    'Error': '错误',
    'Error ID:': '错误 ID：',
    'Warning': '警告',
    'Unknown': '未知',
    'Default': '默认',
    'Enabled': '已启用',
    'Disabled': '已禁用',
    'ON': '开',
    'OFF': '关',

    // ---- 额度 / 套餐横幅 ----
    'Baseline model quota reached': '基础模型额度已用完',
    'See Plans': '查看套餐',
    'Enable Overages': '启用超额用量',
    'View Usage': '查看用量',
    'View plans': '查看套餐',
    'Upgrade': '升级',
    'Usage': '用量',
    'Plan': '套餐',
    'Billing': '账单',
    'Models': '模型',
    'Model': '模型',
    'AI Credits': 'AI 额度',

    // ---- 输入区 ----
    'Ask anything, @ to mention, / for actions': '问点什么，@ 提及文件，/ 使用动作',
    'Ask anything...': '问点什么…',
    'Select model': '选择模型',
    'Select Model': '选择模型',
    'Permissions': '权限',
    'Attach file': '添加附件',

    // ---- 设置页 ----
    'General': '通用',
    'Appearance': '外观',
    'Theme': '主题',
    'Dark': '深色',
    'Light': '浅色',
    'System': '跟随系统',
    'Language': '语言',
    'Notifications': '通知',
    'Privacy': '隐私',
    'Account': '账户',
    'Sign in': '登录',
    'Sign out': '退出登录',
    'Shortcuts': '快捷键',
    'About': '关于',
    'Editor': '编辑器',
    'Terminal': '终端',
    'Browser': '浏览器',
    'Files': '文件',
    'Plugins': '插件',
    'Skills': '技能',
    'Developer': '开发者',
    'Workspace': '工作区',
    'Workspaces': '工作区',
    'New Workspace': '新建工作区',
    'Rules': '规则',
    'Workflows': '工作流',
    'MCP Servers': 'MCP 服务器',
    'Extensions': '扩展',
    'Agent': '智能体',
    'Overview': '概览',
    'History': '历史',
    'Run': '运行',
    'Running': '运行中',
    'Stopped': '已停止',
    'Idle': '空闲',
    'Feedback': '反馈',
    'Provide Feedback': '提供反馈',
    'Update Available': '有可用更新',
    'Troubleshooting': '故障排查',
    'Enable': '启用',
    'Disable': '禁用',
    'Reset': '重置',
    'Apply': '应用',
    'Create': '创建',
    'Add': '添加',
    'Search…': '搜索…',
    'No results': '没有结果',
    'Show more': '显示更多',
    'Show less': '收起',
    'Learn more': '了解更多',
    'Documentation': '文档',
    'Clear': '清空',
    'Clear all': '全部清空',

    // ===== 设置页 · 左侧导航 =====
    'App': '应用',
    'Models & Usage': '模型与用量',
    'Provide Feedback': '提供反馈',

    // ===== 设置页 · 通用 / 账户 =====
    'Manage your plan, credentials, and general preferences.': '管理你的套餐、登录凭据和通用偏好。',
    'Your Plan:': '当前套餐：',
    'Application': '应用',
    'Enable Telemetry': '启用使用数据统计',
    'When toggled on, Antigravity collects usage data to help Google enhance performance and features.':
      '开启后，Antigravity 会收集使用数据，帮助 Google 改进性能与功能。',
    'Marketing Emails': '营销邮件',
    'Receive product updates, tips, and promotions from Google Antigravity via email.':
      '通过邮件接收 Google Antigravity 的产品更新、使用技巧与推广信息。',
    'Email': '邮箱',
    'Sign Out': '退出登录',
    'By using this app, you agree to its': '使用本应用即表示你同意其',
    'Terms of Service': '服务条款',
    'Not in Project': '不在项目中',
    'Version': '版本',
    'App version': '应用版本',
    'Advanced Settings': '高级设置',

    // ===== 设置页 · 应用 / 权限 =====
    'Configure agent execution, queued message delivery, and permissions.':
      '配置智能体执行、消息排队投递与权限。',
    'Execution': '执行',
    'Queued Messages': '排队消息',
    'Configure when follow-up messages are sent.': '配置后续消息的发送时机。',
    'Queue': '排队',
    'Send Immediately': '立即发送',
    'Keyboard shortcuts': '键盘快捷键',
    'Global Permissions': '全局权限',
    'Security Preset': '安全预设',
    'Controls the actions the agent can take.': '控制智能体可以执行哪些操作。',
    'Learn more about': '了解更多关于',
    'Turbo mode': 'Turbo 模式',
    'Tool Permissions': '工具权限',
    'Modify permissions for file, terminal, and MCP tools.': '修改文件、终端和 MCP 工具的权限。',
    'Agent Behavior': '智能体行为',
    'Plan Review Policy': '计划审阅策略',
    'Whether the agent asks you to review its documents.': '智能体是否要求你审阅它生成的文档。',
    'Type': '输入',
    'and select': '并选择',
    'plan': '计划',
    'to have the agent generate a plan.': '让智能体生成计划。',
    'Always Ask': '每次询问',
    'Network Permissions': '网络权限',
    'Network Access Rules': '网络访问规则',
    'Configure allowed and denied URLs for reading.': '配置允许和禁止读取的网址。',
    'Terminal & Tooling Permissions': '终端与工具权限',
    'Commands Outside Sandbox': '沙箱外命令',
    'Configure allowed commands outside the sandbox.': '配置沙箱外允许执行的命令。',

    // ===== 设置页 · 浏览器子智能体 =====
    'Configure the browser subagent. It requires': '配置浏览器子智能体。需要先安装',
    'to be installed.': '。',
    'The browser subagent can be invoked by typing /browser in the conversation input box.':
      '在对话输入框输入 /browser 即可调用浏览器子智能体。',
    'Browser Javascript Execution Policy': '浏览器 JavaScript 执行策略',
    'Controls whether the agent can run custom JavaScript to automate complex browser actions.':
      '控制智能体是否可以运行自定义 JavaScript 来自动化复杂的浏览器操作。',
    'Request Review': '请求审阅',
    'Browser Actuation Rules': '浏览器操作规则',
    'Configure allowed and denied URLs for browser actuation.': '配置浏览器操作时允许和禁止的网址。',

    // ===== 设置页 · 外观 =====
    "Configure the agent's visual theme and display preferences.": '配置智能体的视觉主题与显示偏好。',
    'Contrast': '对比度',
    'Strong': '强烈',
    'Dark Theme': '深色主题',
    'Preset': '预设',
    'Default Dark': '默认深色',
    'Background': '背景',
    'Foreground': '前景',
    'Accent': '强调色',
    'Chat Settings': '对话设置',
    'Verbose Agent Chat': '详细智能体对话',
    'Display and preserve intermediate thinking steps.': '显示并保留中间的思考步骤。',
    'Conversation Width': '对话宽度',
    'Configure the maximum width of the conversation panel.': '配置对话面板的最大宽度。',
    'Narrow': '窄',
    'Wide': '宽',
    'Choose the experience that fits how you work.': '选择适合你工作方式的体验。',
    'Choose between the Default and Project 4K experience.': '在默认体验与 Project 4K 体验之间选择。',
    'Editor Settings': '编辑器设置',
    'Configure editor-specific behaviors and shortcuts.': '配置编辑器专属行为与快捷键。',
    'Marketplace': '插件市场',
    'Marketplace Item URL': '插件市场条目 URL',
    'Changes the base URL on each extension page. You must restart Antigravity to use the new marketplace after changing this value.':
      '修改每个扩展页面的基础 URL。修改后需重启 Antigravity 才能使用新的插件市场。',
    'Marketplace Gallery URL': '插件市场列表 URL',
    'Changes the base URL for marketplace search results. You must restart Antigravity to use the new marketplace after changing this value.':
      '修改插件市场搜索结果的基础 URL。修改后需重启 Antigravity 才能使用新的插件市场。',
    'Selection Actions': '选中操作',
    'Show Selection Actions': '显示选中操作',
    'Show "Edit" and "Chat" buttons when selecting text in the editor.':
      '在编辑器中选中文本时显示「编辑」与「对话」按钮。',
    'To modify editor settings, open Settings within the editor window.':
      '如需修改编辑器设置，请在编辑器窗口内打开设置。',
    'Open Editor Settings': '打开编辑器设置',

    // ===== 设置页 · Jetski Chat =====
    'Configure a chat bot so you can use Jetski directly from Google Chat.':
      '配置聊天机器人，以便直接在 Google Chat 中使用 Jetski。',
    'For help, visit': '需要帮助请访问',
    'or join the': '或加入',
    'chat space': '聊天空间',
    'Setup': '配置',
    'Bot Name': '机器人名称',
    'Avatar URL': '头像 URL',
    'Setup Jetski Chat': '配置 Jetski Chat',

    // ===== 设置页 · 通知 =====
    'Manage your notification preferences.': '管理你的通知偏好。',
    'Enable Notifications for Agent': '启用智能体通知',
    'Show system notifications when your action is needed or the agent finishes.':
      '当需要你操作或智能体完成任务时显示系统通知。',
    'Sound': '声音',
    'Enable Sounds for Agent': '启用智能体提示音',
    'Play a sound when your action is needed or the agent finishes.':
      '当需要你操作或智能体完成任务时播放提示音。',
    'Volume': '音量',
    'Set the volume of agent sounds.': '设置智能体提示音的音量。',

    // ===== 设置页 · 自定义 / 技能 =====
    'Configure default behaviors, skills, and MCP servers.': '配置默认行为、技能与 MCP 服务器。',
    'Token Usage': 'Token 用量',
    'There are no customizations enabled.': '当前没有启用任何自定义项。',
    'Build With Google Plugins': 'Build With Google 插件',
    'Browse and enable plugins from the Build With Google catalog.':
      '浏览并启用 Build With Google 目录中的插件。',
    'Customize': '自定义',

    // ===== 设置页 · 应用行为 =====
    'Manage Antigravity app settings.': '管理 Antigravity 应用设置。',
    'Prevent Sleep': '防止休眠',
    'Prevent the computer from sleeping while the app is running.': '应用运行期间阻止电脑进入睡眠。',
    'Keep In Menu Bar': '保留在菜单栏',
    'Keep the app accessible from the menu bar and running in the background when all windows are closed.':
      '关闭所有窗口后，仍可从菜单栏访问应用并在后台继续运行。',
    'Remote Control': '远程控制',
    'Enable Remote Control': '启用远程控制',
    'Work with local agents from another device.': '从其他设备操作本地智能体。',
    'Notification Settings': '通知设置',
    "To modify notification settings, open your operating system's system preferences.":
      '如需修改通知设置，请打开操作系统的系统偏好设置。',
    'Open System Preferences': '打开系统偏好设置',

    // ===== 设置页 · 反馈 =====
    'Feedback Type': '反馈类型',
    'Bug Report': '问题报告',
    'Feature Request': '功能建议',
    'Auth and Billing': '登录与账单',
    'Remote Control Issue': '远程控制问题',
    'General Feedback': '一般反馈',
    'Description': '描述',
    'Please describe the issue in detail. The more actionable your feedback, the quicker our team can address your request. Some helpful information includes:':
      '请详细描述问题。反馈越具体，我们处理得越快。以下信息会很有帮助：',
    'Steps to reproduce the issue': '复现步骤',
    'Expected behavior': '预期行为',
    'Actual behavior': '实际行为',
    'Any error messages': '错误信息',
    'Any relevant information': '其他相关信息',
    'Steps to Reproduce': '复现步骤',
    'Attach a screenshot (optional)': '附上截图（可选）',
    'Attach Antigravity server logs': '附上 Antigravity 服务端日志',
    'Visit': '访问',
    'Legal Help': '法律帮助',
    'to ask for content changes for legal reasons.': '以提交因法律原因需要修改的内容。',

    // ===== 设置页 · 模型与用量 =====
    'Manage your model quota and credits.': '管理模型额度与 AI 额度。',
    'Model Credits': '模型额度',
    'Enable AI Credit Overages': '启用 AI 额度超额使用',
    "When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits.":
      '开启后，当模型额度用尽时，Antigravity 会使用你的 AI 额度来完成模型请求。Antigravity 始终优先使用模型额度，再使用 AI 额度。',
    'See Activity': '查看明细',
    'Get More AI Credits': '获取更多 AI 额度',
    'Gemini Models': 'Gemini 模型',
    'Weekly Limit Remaining': '周额度剩余',
    'Five Hour Limit Remaining': '5 小时额度剩余',
    'Claude and GPT models': 'Claude 与 GPT 模型',
    'You can upgrade to a Google AI Ultra plan to receive higher rate limits.':
      '升级到 Google AI Ultra 套餐可获得更高的速率上限。',

    // ===== 设置页 · 快捷键 =====
    'Keyboard shortcuts for quick navigation and control.': '用于快速导航与控制的键盘快捷键。',
    'Recommended': '推荐',
    'Open Conversation Picker': '打开对话选择器',
    'Open File Search': '打开文件搜索',
    'Focus Input': '聚焦输入框',
    'Navigation': '导航',
    'Go Back': '后退',
    'Go Forward': '前进',
    'File Picker': '文件选择器',
    'New Tab': '新建标签页',
    'Select Previous Conversation': '选择上一个对话',
    'Select Next Conversation': '选择下一个对话',
    'Previous Pane Tab': '上一个面板标签',
    'Next Pane Tab': '下一个面板标签',
    'Open Settings': '打开设置',
    'Conversation': '对话',
    'Toggle Model Selector': '切换模型选择器',
    'Toggle Voice Recording': '切换语音录制',
    'Find in Pane': '在面板中查找',
    'Add to Chat/Quote': '添加到对话 / 引用',
    'Archive This Conversation': '归档此对话',
    'Layout Controls': '布局控制',
    'Toggle Auxiliary Pane': '切换辅助面板',
    'Toggle Maximize Auxiliary Pane': '切换辅助面板最大化',
    'Toggle Overview Panel': '切换概览面板',
    'Toggle Terminal': '切换终端',
    'Zoom In': '放大',
    'Zoom Out': '缩小',
    'Reset Zoom': '重置缩放',

    // ===== 设置页 · 开发者 =====
    'Developer-only tools. These settings are stored locally in this browser and do not affect other users.':
      '开发者专用工具。这些设置仅保存在本地浏览器中，不影响其他用户。',
    'Regroup Google3 Chats': '重新归组 Google3 对话',
    'Google3 chats will be regrouped into their workspaces in the sidebar.':
      'Google3 对话会在侧栏中重新归入各自的工作区。',
    'This migration may mess up your settings, chats, and sidebar.':
      '此迁移可能会打乱你的设置、对话和侧栏。',
    'Follow the guide at': '请按以下指南操作',
    'to back up your data and run the migration.': '备份数据并执行迁移。',
  };

  const RULES = [
    [/^Resets in (.+)$/, '重置于 $1'],
    [/^Reset in (.+)$/, '重置于 $1'],
    [/^Worked for (.+)$/, '工作用时 $1'],
    [/^Working for (.+)$/, '工作用时 $1'],
    [/^Thought for (.+)$/, '思考用时 $1'],
    [/^(\d+) files? changed$/, '$1 个文件已变更'],
    [/^(\d+) files? changed \+(\d+) -(\d+)$/, '$1 个文件已变更 +$2 -$3'],
    [/^Your plan's baseline quota will refresh on (.+)\. To continue using this model now, enable AI Credit overages\.$/,
      '套餐基础额度将于 $1 刷新。如需继续使用该模型，请启用 AI 额度超额使用。'],
    [/^Individual quota reached.*$/, '个人额度已达上限'],
    [/^Select model, current: (.+)$/, '选择模型，当前：$1'],
    [/^(\d+) credits? remaining$/i, '剩余 $1 额度'],
    [/^Your Plan: (.+)$/, '当前套餐：$1'],
    [/^Available AI Credits: (\d+)$/, '可用 AI 额度：$1'],
    [/^Send feedback as (.+)$/, '以 $1 发送反馈'],
    [/^You have used some of your weekly limit, it will fully refresh in (.+)\.$/, '本周额度已用掉一部分，将在 $1后完全恢复。'],
    [/^You have hit your weekly limit, it refreshes in (.+)\. If on a supported paid plan, you can use AI credits in the interim or upgrade to a higher tier\.$/, '本周额度已用完，将在 $1后恢复。若你使用的是受支持的付费套餐，可在此期间使用 AI 额度，或升级到更高档位。'],
    [/^You have hit your weekly limit, the 5-hour limit does not currently apply\. Your weekly limit will fully refresh in (.+)\.$/, '本周额度已用完，5 小时额度当前不适用。本周额度将在 $1后完全恢复。'],
    [/^(.+) Weekly Limit$/, '$1 周额度'],
  ];

  // 把英文时间单位换成中文：3 days, 7 hours -> 3 天 7 小时
  const fixUnits = (s) => s
    .replace(/(\d+)\s*days?\b/gi, '$1 天')
    .replace(/(\d+)\s*hours?\b/gi, '$1 小时')
    .replace(/(\d+)\s*minutes?\b/gi, '$1 分钟')
    .replace(/(\d+)\s*seconds?\b/gi, '$1 秒')
    .replace(/(\d+\s*(?:天|小时|分钟|秒))\s*,\s*/g, '$1 ');

  const lookup = (key) => {
    if (Object.prototype.hasOwnProperty.call(DICT, key)) return DICT[key];
    for (const [re, rep] of RULES) {
      if (re.test(key)) return fixUnits(key.replace(re, rep));
    }
    return null;
  };

  /* ============================ 2. 文本替换引擎 =========================== */
  const seen = new WeakMap();

  function translateTextNode(node) {
    const raw = node.nodeValue;
    if (!raw) return;
    const key = raw.trim();
    if (!key || key.length > 300 || !/[A-Za-z]/.test(key)) return;
    if (seen.get(node) === raw) return;
    const hit = lookup(key);
    if (!hit || hit === key) return;
    const lead = raw.slice(0, raw.length - raw.trimStart().length);
    const tail = raw.slice(raw.trimEnd().length);
    node.nodeValue = lead + hit + tail;
    seen.set(node, node.nodeValue);
  }

  function translateAttrs(el) {
    for (const attr of ['placeholder', 'aria-label', 'title', 'alt']) {
      const v = el.getAttribute && el.getAttribute(attr);
      if (!v) continue;
      const key = v.trim();
      if (!key || key.length > 300 || !/[A-Za-z]/.test(key)) continue;
      if (el.dataset.agyqAttr === key) continue;
      const hit = lookup(key);
      if (!hit || hit === key) continue;
      el.setAttribute(attr, hit);
      el.dataset.agyqAttr = hit;
    }
  }

  function walk(root) {
    if (!root || root.nodeType === 3) {
      if (root && root.nodeType === 3 && !blocked(root.parentElement)) translateTextNode(root);
      return;
    }
    if (root.nodeType !== 1) return;
    if (blocked(root)) return;
    if (root.tagName === 'INPUT' || root.tagName === 'TEXTAREA') translateAttrs(root);

    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        return blocked(n.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = w.nextNode())) translateTextNode(n);

    const attrs = root.querySelectorAll('[placeholder],[aria-label],[title]');
    for (const el of attrs) {
      if (!blocked(el)) translateAttrs(el);
    }
  }

  let queue = [];
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const items = queue;
    queue = [];
    for (const it of items) {
      try {
        walk(it);
      } catch (e) { /* ignore */ }
    }
  };
  const schedule = (node) => {
    queue.push(node);
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(flush);
    }
  };

  function startI18n() {
    walk(document.body);
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'characterData') {
          schedule(r.target);
        } else if (r.type === 'childList') {
          for (const n of r.addedNodes) {
            if (n.nodeType === 1 || n.nodeType === 3) schedule(n);
          }
        } else if (r.type === 'attributes') {
          schedule(r.target);
        }
      }
    });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'aria-label', 'title'],
    });
  }

  /* ============================ 3. 额度小组件 ============================ */
  const VENDORS = [
    { id: 'claude', name: 'Claude', color: '#FF8A3D', test: /^claude/i },
    { id: 'gpt', name: 'GPT', color: '#F0F0F0', test: /^(gpt|openai)/i },
    { id: 'gemini', name: 'Gemini', color: '#A98BFF', test: /^gemini(?!.*argon)/i },
    // Gemini 4 Argon 有独立周额度，单独一块电池；负向断言保证 argon 不落进 Gemini 桶
    { id: 'argon', name: '4Argon', color: '#4A9EFF', test: /argon/i },
  ];

  const state = {
    vendors: {},          // id -> {level, source, reset, models:[]}
    credits: null,        // {available, total}
    plan: '',
    updatedAt: 0,
    loading: false,
    error: null,
    hasData: false,      // 至少成功拉到过一次数据，之后才能判定某厂商是否真的不存在
  };

  function parseLeadingJson(text) {
    const start = text.indexOf('{');
    if (start < 0) return null;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(text.slice(start, i + 1)); } catch (e) { return null; }
        }
      }
    }
    return null;
  }

  async function fetchStatus() {
    if (state.loading) return;
    state.loading = true;
    render();
    try {
      const csrf = (window.__APP_CONFIG__ && window.__APP_CONFIG__.csrfToken) || '';
      const res = await fetch('/exa.language_server_pb.LanguageServerService/GetUserStatus', {
        method: 'POST',
        headers: {
          'content-type': 'application/grpc-web+json',
          'x-grpc-web': '1',
          'x-codeium-csrf-token': csrf,
          'x-user-agent': 'CONNECT_ES_USER_AGENT',
        },
        body: '\u0000\u0000\u0000\u0000\u0002{}',
      });
      const text = await res.text();
      const json = parseLeadingJson(text);
      applyStatus(json);
      state.error = null;
    } catch (e) {
      state.error = e;
    } finally {
      state.loading = false;
      state.updatedAt = Date.now();
      render();
    }
  }

  function applyStatus(json) {
    const us = json && (json.userStatus || json);
    if (!us) return;
    const ps = us.planStatus || {};
    const pi = ps.planInfo || {};
    state.plan = pi.planName || '';
    if (typeof ps.availablePromptCredits === 'number' && typeof pi.monthlyPromptCredits === 'number' && pi.monthlyPromptCredits > 0) {
      state.credits = { available: ps.availablePromptCredits, total: pi.monthlyPromptCredits };
    }

    const cfgs = ((us.cascadeModelConfigData || {}).clientModelConfigs) || [];
    console.log('[agy-cn] 模型配置：', cfgs.map((m) => (m.modelId || '?') + ' | ' + (m.label || '?')).join('  ;;  ') || '（空）');
    const next = {};
    for (const v of VENDORS) next[v.id] = { id: v.id, models: [], level: null, source: null, reset: null, exhausted: false };

    for (const m of cfgs) {
      const id = m.modelId || '';
      const label = m.label || '';
      // modelId 和显示名都参与匹配，防止其中一边不带 argon 字样时漏归
      const v = VENDORS.find((x) => x.test.test(id) || x.test.test(label));
      if (!v) continue;
      const q = m.quotaInfo || {};
      const frac = typeof q.remainingFraction === 'number' ? q.remainingFraction : null;
      next[v.id].models.push({ label: m.label || id, frac, reset: q.resetTime || null });
      if (frac === 0) next[v.id].exhausted = true;
    }

    const creditRatio = state.credits && state.credits.total > 0
      ? Math.max(0, Math.min(1, state.credits.available / state.credits.total))
      : null;

    for (const v of VENDORS) {
      const bucket = next[v.id];
      const fracs = bucket.models.map((m) => m.frac).filter((f) => typeof f === 'number');
      if (fracs.length) {
        bucket.level = Math.min(...fracs);
        bucket.source = 'model';
        bucket.exhausted = bucket.exhausted || bucket.level <= 0;
      } else if (bucket.models.length && creditRatio !== null) {
        bucket.level = creditRatio;
        bucket.source = 'credits';
        bucket.exhausted = bucket.exhausted || creditRatio <= 0;
      } else {
        bucket.level = null;
        bucket.source = null;
      }
      // 重置时间：取该厂商最早的 resetTime
      const resets = bucket.models.map((m) => m.reset).filter(Boolean).map((s) => Date.parse(s)).filter((n) => !isNaN(n));
      if (resets.length) bucket.reset = Math.min(...resets);
    }
    state.vendors = next;
    state.hasData = true;
  }

  // 账号里完全没有该厂商的模型（比如套餐不含 4Argon）→ 隐藏这块电池
  function isAbsent(b) {
    return Array.isArray(b.models) && b.models.length === 0 && b.level === null;
  }

  let root = null;

  function build() {
    const el = document.createElement('div');
    el.id = 'agyq';
    el.setAttribute('data-agyq-skip', '1');
    el.innerHTML = VENDORS.map((v) => `
      <div class="agyq-item" data-v="${v.id}" data-state="unknown" style="--c:${v.color}">
        <span class="agyq-name">${v.name}</span>
        <span class="agyq-bat"><span class="agyq-fill"></span></span>
        <span class="agyq-pct">--</span>
      </div>`).join('') + '<div class="agyq-tip" data-agyq-skip="1"></div>';
    return el;
  }

  const fmtPct = (l) => (l === null || l === undefined ? '--' : Math.round(l * 100) + '%');

  function fmtReset(ts) {
    if (!ts) return '';
    const diff = ts - Date.now();
    if (diff <= 0) return '即将重置';
    const totalMin = Math.floor(diff / 60000);
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    if (d > 0) return `${d}天${h}小时`;
    if (h > 0) return `${h}小时${m}分`;
    return `${m}分`;
  }

  function render() {
    if (!root) return;
    root.classList.toggle('is-busy', state.loading);

    for (const v of VENDORS) {
      const item = root.querySelector(`.agyq-item[data-v="${v.id}"]`);
      if (!item) continue;
      const b = state.vendors[v.id] || { level: null };
      const absent = state.hasData && isAbsent(b);
      item.style.display = absent ? 'none' : '';
      const lv = b.level;
      const pct = item.querySelector('.agyq-pct');
      const fill = item.querySelector('.agyq-fill');
      const visual = lv === null ? 0 : Math.max(lv > 0 ? 0.06 : 0, Math.min(1, lv));
      fill.style.width = (visual * 100).toFixed(1) + '%';
      pct.textContent = fmtPct(lv);
      let st = 'ok';
      if (lv === null) st = 'unknown';
      else if (lv <= 0.001) st = 'empty';
      else if (lv < 0.15) st = 'low';
      item.dataset.state = st;
    }

    const tip = root.querySelector('.agyq-tip');
    const rows = VENDORS.map((v) => {
      const b = state.vendors[v.id];
      if (!b || (state.hasData && isAbsent(b))) return '';
      const models = b.models.length;
      const src = b.source === 'credits' ? '共享积分' : b.source === 'model' ? '模型额度' : '无数据';
      return `<div class="agyq-row" style="--c:${v.color}">
          <b>${v.name}</b>
          <i>${fmtPct(b.level)} · ${src}${b.reset ? ' · ' + fmtReset(b.reset) : ''}</i>
        </div>`;
    }).join('');

    const creditLine = state.credits
      ? `<div class="agyq-row"><b style="--c:#9ad1ff">共享积分</b><i>${state.credits.available} / ${state.credits.total}</i></div>`
      : '';

    const updated = state.updatedAt
      ? new Date(state.updatedAt).toLocaleTimeString('zh-CN', { hour12: false })
      : '—';

    tip.innerHTML = `
      <h4>模型额度<span>${state.plan ? state.plan + ' 套餐' : ''}</span></h4>
      ${rows}
      ${creditLine ? '<div class="agyq-sep"></div>' + creditLine : ''}
      <div class="agyq-foot"><span>更新 ${updated}</span><span>点击立即刷新</span></div>`;
  }

  function mount() {
    if (document.getElementById('agyq')) { root = document.getElementById('agyq'); return true; }
    if (!document.body) return false;
    root = build();
    const inElectron = !!(window.electronNative || navigator.userAgent.includes('Electron'));
    root.style.position = 'fixed';
    root.style.top = '5px';
    root.style.right = inElectron ? '146px' : '12px';
    document.body.appendChild(root);
    root.addEventListener('click', (e) => {
      if (e.target.closest('.agyq-tip')) return;
      root.classList.add('is-flash');
      setTimeout(() => root.classList.remove('is-flash'), 720);
      state.updatedAt = 0;
      fetchStatus();
    });
    render();
    return true;
  }

  /* ============================ 4. 启动 ============================ */
  function boot() {
    if (!mount()) {
      setTimeout(boot, 300);
      return;
    }
    startI18n();
    fetchStatus();
    setInterval(fetchStatus, 60000);

    // 页面重新渲染把组件顶掉时自动补回
    setInterval(() => {
      if (!document.getElementById('agyq')) {
        root = null;
        mount();
      }
    }, 2000);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') fetchStatus();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
