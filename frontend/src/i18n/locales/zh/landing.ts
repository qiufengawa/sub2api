export default {
  batchImageGuide: {
    title: '图片批量生成',
    description: '一次提交多条提示词，任务完成后可统一下载图片结果'
  },
  // Home Page
  home: {
    viewOnGithub: '在 GitHub 上查看',
    viewDocs: '查看文档',
    docs: '文档',
    switchToLight: '切换到浅色模式',
    switchToDark: '切换到深色模式',
    dashboard: '控制台',
    login: '登录',
    getStarted: '立即开始',
    goToDashboard: '进入控制台',
    viewModelsAndPricing: '查看模型与价格',
    gatewayPreviewLabel: '{site} 多模型网关预览',
    coreCapabilities: '核心能力',
    nav: {
      primary: '主页导航',
      mobile: '移动端导航',
      toggleMenu: '展开或收起导航菜单',
      advantages: '核心优势',
      models: '模型覆盖',
      integration: '接入方式',
      faq: '常见问题',
      modelPlaza: '模型广场'
    },
    core: {
      unifiedBaseUrl: '统一 Base URL',
      multiModelRelay: '多模型转发',
      pricingReference: '透明价格参考',
      usageAnalytics: '完整用量分析'
    },
    sections: {
      why: {
        title: '为什么选择 {site}',
        leadTitle: '减少重复接入工作，保留灵活的模型选择',
        leadDescription: '不必为每个厂商分别维护接口、鉴权和 SDK 适配。通过统一的 OpenAI 兼容网关，在同一个接入层中测试、比较、路由和切换模型。',
        items: {
          pricing: {
            title: '清晰的价格参考',
            description: '在选择模型前比较价格、倍率和能力，为不同工作负载控制成本。'
          },
          coverage: {
            title: '广泛的模型覆盖',
            description: '统一接入 GPT、Claude、Gemini、DeepSeek、Qwen、Kimi、GLM 等主流模型系列。'
          },
          migration: {
            title: '更快完成迁移',
            description: '大多数 OpenAI SDK 项目只需替换 Base URL、API 密钥和模型名即可开始。'
          }
        }
      },
      prompts: {
        title: '提示词笔记',
        description: '使用这些提示词快速验证模型行为、迁移现有项目、约束结构化输出，并对不同厂商的结果进行基准比较。',
        items: {
          integration: { label: '接入', text: '生成一份使用 {site} 的 OpenAI 兼容 SDK 示例' },
          migration: { label: '迁移', text: '将 base_url、api_key 和模型设置迁移到统一网关' },
          selection: { label: '选型', text: '根据任务推荐文本、视觉、嵌入或推理模型' },
          schema: { label: '结构', text: '使用 JSON Schema 约束响应，便于稳定解析' },
          benchmark: { label: '评测', text: '从准确率、延迟、成本和稳定性比较多个模型' },
          streaming: { label: '流式', text: '设计支持前端增量渲染的流式响应流程' }
        }
      },
      models: {
        title: '模型覆盖',
        description: '可用模型、价格倍率、上下文长度和渠道状态会动态变化，请以模型广场和控制台中的实时信息为准。',
        openPlaza: '打开模型广场查看实时信息',
        items: {
          openai: { family: 'GPT / o 系列', description: '适合通用对话、编程、推理、结构化输出和多轮应用。' },
          anthropic: { family: 'Claude 系列', description: '适合长上下文分析、代码审查、写作优化和复杂推理。' },
          gemini: { family: 'Gemini 系列', description: '适合多模态理解、长上下文处理、视觉分析和知识整合。' },
          grok: { family: 'Grok 系列', description: '适合通用对话、实时信息处理、编码和推理工作负载。' },
          deepseek: { family: 'DeepSeek 系列', description: '适合推理、编程、数学、批处理和成本敏感型场景。' },
          more: { name: '更多厂商', family: 'Qwen / Kimi / GLM 等', description: '更多兼容模型会随渠道持续接入，具体以模型广场为准。' }
        }
      },
      pricing: {
        title: '价格参考',
        items: {
          models: { title: '按模型计价', description: '不同模型拥有不同成本结构，可针对每种工作负载平衡质量、延迟和预算。' },
          usage: { title: '按实际需求使用', description: '原型、批处理、内部工具和生产流量可以通过同一网关按需选择模型。' },
          live: { title: '以实时数据为准', description: '模型可用性和价格可能变化，上线前请在模型广场核对最新信息。' }
        }
      },
      integration: {
        title: '接入地图',
        description: '沿用应用已经熟悉的 OpenAI 风格接入方式，替换服务地址、选择可用模型，并在流量增长后持续查看用量。',
        modelPlaceholder: '从模型广场选择可用模型',
        capabilityNote: '视觉、音频、重排等更多接口取决于当前上游渠道能力。'
      },
      launch: {
        title: '开始使用',
        items: {
          key: { title: '创建 API 密钥', description: '在控制台创建密钥，并按项目、环境或团队组织使用范围。' },
          endpoint: { title: '替换接入地址', description: '保留 OpenAI 风格 SDK 流程，只替换 Base URL 与 API 密钥。' },
          model: { title: '选择并测试模型', description: '发送测试请求前核对模型可用性、价格和渠道状态。' },
          monitor: { title: '上线后持续监控', description: '通过日志、额度和错误详情优化模型、提示词与成本结构。' }
        }
      },
      capabilities: {
        title: '平台能力',
        items: {
          sdk: { title: 'SDK 兼容', description: '兼容常见 OpenAI 风格 SDK，减少迁移改动。' },
          streaming: { title: '流式输出', description: '支持聊天、写作和长内容生成的增量响应。' },
          structured: { title: '结构化输出', description: '在模型支持时使用 JSON、工具调用与 Schema 输出。' },
          tracking: { title: '用量追踪', description: '在一个控制台查看请求日志、额度、错误和模型活动。' }
        }
      },
      useCases: {
        title: '适用场景',
        lead: '一层统一网关，覆盖实验、产品、团队、智能体、内容与 RAG。',
        items: {
          experiments: { title: 'AI 应用实验：', description: '对话、摘要、搜索、写作、翻译、图像理解与自动化。' },
          business: { title: '业务系统接入：', description: '通过一个网关连接多个模型厂商，减少专用维护成本。' },
          agents: { title: '智能体工作流：', description: '为规划、执行、检索、视觉和结构化输出分配不同模型。' },
          rag: { title: '知识库问答：', description: '结合嵌入、对话接口和业务数据构建轻量 RAG 系统。' }
        }
      },
      faq: {
        title: '常见问题',
        items: {
          official: { question: '{site} 是模型厂商的官方服务吗？', answer: '不是。{site} 是第三方模型网关，模型可用性、价格和使用规则取决于平台设置与上游渠道。' },
          sdk: { question: '可以继续使用现有 OpenAI SDK 吗？', answer: '通常可以。先替换 Base URL 和 API 密钥，再按所选模型调整工具、流式输出等字段。' },
          models: { question: '怎样确认当前支持哪些模型？', answer: '请在模型广场查看实时可用模型、上下文长度、价格倍率和渠道状态。' },
          production: { question: '适合直接用于生产环境吗？', answer: '上线关键流量前应完成稳定性测试、额度规划、错误处理和日志监控。' }
        }
      }
    },
    // 新增：面向用户的价值主张
    heroSubtitle: '一个密钥，畅用多个 AI 模型',
    heroDescription: '无需管理多个订阅账号，一站式接入 Claude、GPT、Gemini 等主流 AI 服务',
    tags: {
      subscriptionToApi: '订阅转 API',
      stickySession: '会话保持',
      realtimeBilling: '按量计费'
    },
    // 用户痛点区块
    painPoints: {
      title: '你是否也遇到这些问题？',
      items: {
        expensive: {
          title: '订阅费用高',
          desc: '每个 AI 服务都要单独订阅，每月支出越来越多'
        },
        complex: {
          title: '多账号难管理',
          desc: '不同平台的账号、密钥分散各处，管理起来很麻烦'
        },
        unstable: {
          title: '服务不稳定',
          desc: '单一账号容易触发限制，影响正常使用'
        },
        noControl: {
          title: '用量无法控制',
          desc: '不知道钱花在哪了，也无法限制团队成员的使用'
        }
      }
    },
    // 解决方案区块
    solutions: {
      title: '我们帮你解决',
      subtitle: '简单三步，开始省心使用 AI'
    },
    features: {
      unifiedGateway: '一键接入',
      unifiedGatewayDesc: '获取一个 API 密钥，即可调用所有已接入的 AI 模型，无需分别申请。',
      multiAccount: '稳定可靠',
      multiAccountDesc: '智能调度多个上游账号，自动切换和负载均衡，告别频繁报错。',
      balanceQuota: '用多少付多少',
      balanceQuotaDesc: '按实际使用量计费，支持设置配额上限，团队用量一目了然。'
    },
    // 优势对比
    comparison: {
      title: '为什么选择我们？',
      headers: {
        feature: '对比项',
        official: '官方订阅',
        us: '本平台'
      },
      items: {
        pricing: {
          feature: '付费方式',
          official: '固定月费，用不完也付',
          us: '按量付费，用多少付多少'
        },
        models: {
          feature: '模型选择',
          official: '单一服务商',
          us: '多模型随意切换'
        },
        management: {
          feature: '账号管理',
          official: '每个服务单独管理',
          us: '统一密钥，一站管理'
        },
        stability: {
          feature: '服务稳定性',
          official: '单账号易触发限制',
          us: '多账号池，自动切换'
        },
        control: {
          feature: '用量控制',
          official: '无法限制',
          us: '可设配额、查明细'
        }
      }
    },
    providers: {
      title: '已支持的 AI 模型',
      description: '一个 API，多种选择',
      supported: '已支持',
      soon: '即将推出',
      claude: 'Claude',
      gemini: 'Gemini',
      antigravity: 'Antigravity',
      more: '更多'
    },
    // CTA 区块
    cta: {
      title: '准备好开始了吗？',
      description: '注册即可获得免费试用额度，体验一站式 AI 服务',
      button: '免费注册'
    },
    footer: {
      allRightsReserved: '保留所有权利。',
      poweredBy: '技术支持：'
    }
  },

  // Key Usage Query Page
  keyUsage: {
    showApiKey: '显示 API 密钥',
    hideApiKey: '隐藏 API 密钥',
    title: 'API Key 用量查询',
    subtitle: '输入您的 API Key 以查看实时消费金额与使用状态',
    placeholder: 'sk-ant-mirror-xxxxxxxxxxxx',
    query: '查询',
    querying: '查询中...',
    privacyNote: '您的 Key 仅在浏览器本地处理，不会被存储',
    dateRange: '统计范围:',
    dateRangeToday: '今日',
    dateRange7d: '7 天',
    dateRange30d: '30 天',
    dateRange90d: '90 天',
    dateRangeCustom: '自定义',
    customStartDate: '自定义范围开始日期',
    customEndDate: '自定义范围结束日期',
    apply: '应用',
    used: '已使用',
    detailInfo: '详细信息',
    tokenStats: 'Token 统计',
    dailyDetail: '按日明细',
    modelStats: '模型用量统计',
    // Table headers
    date: '日期',
    model: '模型',
    requests: '请求数',
    inputTokens: '输入 Tokens',
    outputTokens: '输出 Tokens',
    cacheCreationTokens: '缓存创建',
    cacheReadTokens: '缓存读取',
    cacheWriteTokens: '缓存写入',
    totalTokens: '总 Tokens',
    cost: '费用',
    // Status
    quotaMode: 'Key 限额模式',
    walletBalance: '钱包余额',
    statusActive: '正常',
    statusQuotaExhausted: '额度已用尽',
    statusExpired: '已过期',
    statusUnknown: '未知状态',
    // Ring card titles
    totalQuota: '总额度',
    limit5h: '5 小时限额',
    limitDaily: '日限额',
    limit7d: '7 天限额',
    limitWeekly: '周限额',
    limitMonthly: '月限额',
    // Detail rows
    remainingQuota: '剩余额度',
    expiresAt: '过期时间',
    todayExpires: '(今日到期)',
    daysLeft: '({days} 天)',
    usedQuota: '已用额度',
    resetNow: '即将重置',
    resetsIn: '{time} 后重置',
    subscriptionType: '订阅类型',
    subscriptionExpires: '订阅到期',
    // Usage stat cells
    todayRequests: '今日请求',
    todayInputTokens: '今日输入',
    todayOutputTokens: '今日输出',
    todayTokens: '今日 Tokens',
    todayCacheCreation: '今日缓存创建',
    todayCacheRead: '今日缓存读取',
    todayCost: '今日费用',
    rpmTpm: 'RPM / TPM',
    totalRequests: '累计请求',
    totalInputTokens: '累计输入',
    totalOutputTokens: '累计输出',
    totalTokensLabel: '累计 Tokens',
    totalCacheCreation: '累计缓存创建',
    totalCacheRead: '累计缓存读取',
    totalCost: '累计费用',
    avgDuration: '平均耗时',
    // Messages
    enterApiKey: '请输入 API Key',
    querySuccess: '查询成功',
    queryFailed: '查询失败',
    queryFailedRetry: '查询失败，请稍后重试',
    noDailyUsage: '暂无按日用量数据',
  },

  // Setup Wizard
  setup: {
    title: 'Sub2API 安装向导',
    description: '配置您的 Sub2API 实例',
    database: {
      title: '数据库配置',
      description: '连接到您的 PostgreSQL 数据库',
      host: '主机',
      port: '端口',
      username: '用户名',
      password: '密码',
      databaseName: '数据库名称',
      sslMode: 'SSL 模式',
      passwordPlaceholder: '密码',
      ssl: {
        disable: '禁用',
        require: '要求',
        verifyCa: '验证 CA',
        verifyFull: '完全验证'
      }
    },
    redis: {
      title: 'Redis 配置',
      description: '连接到您的 Redis 服务器',
      host: '主机',
      port: '端口',
      username: '用户名（可选）',
      password: '密码（可选）',
      database: '数据库',
      usernamePlaceholder: '默认用户留空',
      passwordPlaceholder: '密码',
      enableTls: '启用 TLS',
      enableTlsHint: '连接 Redis 时使用 TLS（公共 CA 证书）'
    },
    admin: {
      title: '管理员账户',
      description: '创建您的管理员账户',
      email: '邮箱',
      password: '密码',
      confirmPassword: '确认密码',
      passwordPlaceholder: '至少 8 个字符',
      confirmPasswordPlaceholder: '确认密码',
      passwordMismatch: '密码不匹配'
    },
    ready: {
      title: '准备安装',
      description: '检查您的配置并完成安装',
      database: '数据库',
      redis: 'Redis',
      adminEmail: '管理员邮箱'
    },
    status: {
      testing: '测试中...',
      success: '连接成功',
      testConnection: '测试连接',
      installing: '安装中...',
      completeInstallation: '完成安装',
      completed: '安装完成！',
      redirecting: '正在跳转到登录页面...',
      restarting: '服务正在重启，请稍候...',
      timeout: '服务重启时间超出预期，请手动刷新页面。'
    }
  },

  // Common
}
