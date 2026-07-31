export default {
  batchImageGuide: {
    title: 'Batch Image Generation',
    description: 'Submit multiple prompts in one job and download the generated images when complete'
  },
  // Home Page
  home: {
    viewOnGithub: 'View on GitHub',
    viewDocs: 'View Documentation',
    docs: 'Docs',
    switchToLight: 'Switch to Light Mode',
    switchToDark: 'Switch to Dark Mode',
    dashboard: 'Dashboard',
    login: 'Login',
    getStarted: 'Get Started',
    goToDashboard: 'Go to Dashboard',
    viewModelsAndPricing: 'Models & Pricing',
    gatewayPreviewLabel: '{site} multi-model gateway preview',
    coreCapabilities: 'Core capabilities',
    nav: {
      primary: 'Primary navigation',
      mobile: 'Mobile navigation',
      toggleMenu: 'Toggle navigation menu',
      advantages: 'Advantages',
      models: 'Models',
      integration: 'Integration',
      faq: 'FAQ',
      modelPlaza: 'Model Plaza'
    },
    core: {
      unifiedBaseUrl: 'Unified Base URL',
      multiModelRelay: 'Multi-model Relay',
      pricingReference: 'Transparent Pricing',
      usageAnalytics: 'Usage Analytics'
    },
    sections: {
      why: {
        title: 'Why {site}',
        leadTitle: 'Reduce integration work and keep model choice flexible',
        leadDescription: 'Avoid maintaining separate endpoints, authentication flows, and SDK adaptations for every provider. Test, compare, route, and switch models through one OpenAI-compatible integration layer.',
        items: {
          pricing: { title: 'Clear pricing reference', description: 'Compare prices, multipliers, and capabilities before choosing the right model for each workload.' },
          coverage: { title: 'Broad model coverage', description: 'Access popular model families including GPT, Claude, Gemini, DeepSeek, Qwen, Kimi, GLM, and more.' },
          migration: { title: 'Faster migration', description: 'Most OpenAI SDK projects only need a new Base URL, API key, and model name to get started.' }
        }
      },
      prompts: {
        title: 'Prompt Notes',
        description: 'Use these prompts to validate model behavior, migrate existing projects, enforce structured outputs, and benchmark results across providers.',
        items: {
          integration: { label: 'Integration', text: 'Generate an OpenAI-compatible SDK example using {site}' },
          migration: { label: 'Migration', text: 'Move base_url, api_key, and model settings to a unified gateway' },
          selection: { label: 'Selection', text: 'Recommend a text, vision, embedding, or reasoning model for a task' },
          schema: { label: 'Schema', text: 'Constrain responses to JSON Schema for reliable parsing' },
          benchmark: { label: 'Benchmark', text: 'Compare models by accuracy, latency, cost, and reliability' },
          streaming: { label: 'Streaming', text: 'Design streaming responses with incremental frontend rendering' }
        }
      },
      models: {
        title: 'Model Coverage',
        description: 'Available models, pricing multipliers, context length, and channel status change over time. Refer to Model Plaza and the dashboard for live information.',
        openPlaza: 'Open Model Plaza for live information',
        items: {
          openai: { family: 'GPT / o Series', description: 'General chat, coding, reasoning, structured output, and multi-turn workflows.' },
          anthropic: { family: 'Claude Series', description: 'Long-context analysis, code review, writing refinement, and complex reasoning.' },
          gemini: { family: 'Gemini Series', description: 'Multimodal understanding, long-context processing, visual analysis, and synthesis.' },
          grok: { family: 'Grok Series', description: 'General conversation, real-time information, coding, and reasoning workloads.' },
          deepseek: { family: 'DeepSeek Series', description: 'Reasoning, coding, math, batch workflows, and cost-sensitive scenarios.' },
          more: { name: 'More Providers', family: 'Qwen / Kimi / GLM and more', description: 'Additional compatible models are continuously added through available channels.' }
        }
      },
      pricing: {
        title: 'Pricing Reference',
        items: {
          models: { title: 'Model-based pricing', description: 'Balance quality, latency, and budget per workload across different model cost profiles.' },
          usage: { title: 'Use what you need', description: 'Run prototypes, batch jobs, internal tools, and production traffic through the same gateway.' },
          live: { title: 'Live data wins', description: 'Availability and pricing may change. Check Model Plaza before launching production traffic.' }
        }
      },
      integration: {
        title: 'Integration Map',
        description: 'Keep the OpenAI-style integration your application already understands. Replace the endpoint, choose an available model, and monitor usage as traffic grows.',
        modelPlaceholder: 'choose an available model from Model Plaza',
        capabilityNote: 'Vision, audio, rerank, and other endpoints depend on current upstream channel support.'
      },
      launch: {
        title: 'Launch Flow',
        items: {
          key: { title: 'Create an API key', description: 'Create a key in the console and organize it by project, environment, or team.' },
          endpoint: { title: 'Update your endpoint', description: 'Keep your OpenAI-style SDK workflow and replace only the Base URL and API key.' },
          model: { title: 'Select and test a model', description: 'Check availability, pricing, and channel status before sending test requests.' },
          monitor: { title: 'Monitor after launch', description: 'Use logs, quota, and error details to improve model choice, prompts, and cost.' }
        }
      },
      capabilities: {
        title: 'Platform Capabilities',
        items: {
          sdk: { title: 'SDK Compatibility', description: 'Works with common OpenAI-style SDKs and minimizes migration changes.' },
          streaming: { title: 'Streaming Output', description: 'Supports incremental responses for chat, writing, and long generation.' },
          structured: { title: 'Structured Output', description: 'Use JSON, tools, function calling, or schemas when supported.' },
          tracking: { title: 'Usage Tracking', description: 'Review request logs, quota, errors, and model activity in one place.' }
        }
      },
      useCases: {
        title: 'Use Cases',
        lead: 'One gateway layer for experiments, products, teams, agents, content, and RAG.',
        items: {
          experiments: { title: 'AI app experiments: ', description: 'chat, summarization, search, writing, translation, vision, and automation.' },
          business: { title: 'Business integrations: ', description: 'connect multiple providers through one gateway and reduce maintenance.' },
          agents: { title: 'Agent workflows: ', description: 'assign models to planning, execution, retrieval, vision, and structured output.' },
          rag: { title: 'Knowledge base Q&A: ', description: 'combine embeddings, chat endpoints, and business data for lightweight RAG.' }
        }
      },
      faq: {
        title: 'FAQ',
        items: {
          official: { question: 'Is {site} an official model provider?', answer: 'No. {site} is a third-party gateway. Availability, pricing, and usage rules depend on platform settings and upstream channels.' },
          sdk: { question: 'Can I keep using my current OpenAI SDK?', answer: 'Usually yes. Replace the Base URL and API key, then adjust model, tools, streaming, and other fields as needed.' },
          models: { question: 'How do I check supported models?', answer: 'Use Model Plaza for current availability, context length, pricing multipliers, and channel status.' },
          production: { question: 'Is it suitable for production?', answer: 'Run stability tests, plan quota, implement error handling, and monitor logs before moving critical traffic.' }
        }
      }
    },
    // User-focused value proposition
    heroSubtitle: 'One Key, All AI Models',
    heroDescription: 'No need to manage multiple subscriptions. Access Claude, GPT, Gemini and more with a single API key',
    tags: {
      subscriptionToApi: 'Subscription to API',
      stickySession: 'Session Persistence',
      realtimeBilling: 'Pay As You Go'
    },
    // Pain points section
    painPoints: {
      title: 'Sound Familiar?',
      items: {
        expensive: {
          title: 'High Subscription Costs',
          desc: 'Paying for multiple AI subscriptions that add up every month'
        },
        complex: {
          title: 'Account Chaos',
          desc: 'Managing scattered accounts and API keys across different platforms'
        },
        unstable: {
          title: 'Service Interruptions',
          desc: 'Single accounts hitting rate limits and disrupting your workflow'
        },
        noControl: {
          title: 'No Usage Control',
          desc: "Can't track where your money goes or limit team member usage"
        }
      }
    },
    // Solutions section
    solutions: {
      title: 'We Solve These Problems',
      subtitle: 'Three simple steps to stress-free AI access'
    },
    features: {
      unifiedGateway: 'One-Click Access',
      unifiedGatewayDesc: 'Get a single API key to call all connected AI models. No separate applications needed.',
      multiAccount: 'Always Reliable',
      multiAccountDesc: 'Smart routing across multiple upstream accounts with automatic failover. Say goodbye to errors.',
      balanceQuota: 'Pay What You Use',
      balanceQuotaDesc: 'Usage-based billing with quota limits. Full visibility into team consumption.'
    },
    // Comparison section
    comparison: {
      title: 'Why Choose Us?',
      headers: {
        feature: 'Comparison',
        official: 'Official Subscriptions',
        us: 'Our Platform'
      },
      items: {
        pricing: {
          feature: 'Pricing',
          official: 'Fixed monthly fee, pay even if unused',
          us: 'Pay only for what you use'
        },
        models: {
          feature: 'Model Selection',
          official: 'Single provider only',
          us: 'Switch between models freely'
        },
        management: {
          feature: 'Account Management',
          official: 'Manage each service separately',
          us: 'Unified key, one dashboard'
        },
        stability: {
          feature: 'Stability',
          official: 'Single account rate limits',
          us: 'Multi-account pool, auto-failover'
        },
        control: {
          feature: 'Usage Control',
          official: 'Not available',
          us: 'Quotas & detailed analytics'
        }
      }
    },
    providers: {
      title: 'Supported AI Models',
      description: 'One API, Multiple Choices',
      supported: 'Supported',
      soon: 'Soon',
      claude: 'Claude',
      gemini: 'Gemini',
      antigravity: 'Antigravity',
      more: 'More'
    },
    // CTA section
    cta: {
      title: 'Ready to Get Started?',
      description: 'Sign up now and get free trial credits to experience seamless AI access',
      button: 'Sign Up Free'
    },
    footer: {
      allRightsReserved: 'All rights reserved.',
      poweredBy: 'Powered by'
    }
  },

  // Key Usage Query Page
  keyUsage: {
    showApiKey: 'Show API key',
    hideApiKey: 'Hide API key',
    title: 'API Key Usage',
    subtitle: 'Enter your API Key to view real-time spending and usage status',
    placeholder: 'sk-ant-mirror-xxxxxxxxxxxx',
    query: 'Query',
    querying: 'Querying...',
    privacyNote: 'Your Key is processed locally in the browser and will not be stored',
    dateRange: 'Date Range:',
    dateRangeToday: 'Today',
    dateRange7d: '7 Days',
    dateRange30d: '30 Days',
    dateRange90d: '90 Days',
    dateRangeCustom: 'Custom',
    customStartDate: 'Custom range start date',
    customEndDate: 'Custom range end date',
    apply: 'Apply',
    used: 'Used',
    detailInfo: 'Detail Information',
    tokenStats: 'Token Statistics',
    dailyDetail: 'Daily Detail',
    modelStats: 'Model Usage Statistics',
    // Table headers
    date: 'Date',
    model: 'Model',
    requests: 'Requests',
    inputTokens: 'Input Tokens',
    outputTokens: 'Output Tokens',
    cacheCreationTokens: 'Cache Creation',
    cacheReadTokens: 'Cache Read',
    cacheWriteTokens: 'Cache Write',
    totalTokens: 'Total Tokens',
    cost: 'Cost',
    // Status
    quotaMode: 'Key Quota Mode',
    walletBalance: 'Wallet Balance',
    statusActive: 'Active',
    statusQuotaExhausted: 'Quota Exhausted',
    statusExpired: 'Expired',
    statusUnknown: 'Unknown',
    // Ring card titles
    totalQuota: 'Total Quota',
    limit5h: '5-Hour Limit',
    limitDaily: 'Daily Limit',
    limit7d: '7-Day Limit',
    limitWeekly: 'Weekly Limit',
    limitMonthly: 'Monthly Limit',
    // Detail rows
    remainingQuota: 'Remaining Quota',
    expiresAt: 'Expires At',
    todayExpires: '(expires today)',
    daysLeft: '({days} days)',
    usedQuota: 'Used Quota',
    resetNow: 'Resetting soon',
    resetsIn: 'Resets in {time}',
    subscriptionType: 'Subscription Type',
    subscriptionExpires: 'Subscription Expires',
    // Usage stat cells
    todayRequests: 'Today Requests',
    todayInputTokens: 'Today Input',
    todayOutputTokens: 'Today Output',
    todayTokens: 'Today Tokens',
    todayCacheCreation: 'Today Cache Creation',
    todayCacheRead: 'Today Cache Read',
    todayCost: 'Today Cost',
    rpmTpm: 'RPM / TPM',
    totalRequests: 'Total Requests',
    totalInputTokens: 'Total Input',
    totalOutputTokens: 'Total Output',
    totalTokensLabel: 'Total Tokens',
    totalCacheCreation: 'Total Cache Creation',
    totalCacheRead: 'Total Cache Read',
    totalCost: 'Total Cost',
    avgDuration: 'Avg Duration',
    // Messages
    enterApiKey: 'Please enter an API Key',
    querySuccess: 'Query successful',
    queryFailed: 'Query failed',
    queryFailedRetry: 'Query failed, please try again later',
    noDailyUsage: 'No daily usage data',
  },

  // Setup Wizard
  setup: {
    title: 'Sub2API Setup',
    description: 'Configure your Sub2API instance',
    database: {
      title: 'Database Configuration',
      description: 'Connect to your PostgreSQL database',
      host: 'Host',
      port: 'Port',
      username: 'Username',
      password: 'Password',
      databaseName: 'Database Name',
      sslMode: 'SSL Mode',
      passwordPlaceholder: 'Password',
      ssl: {
        disable: 'Disable',
        require: 'Require',
        verifyCa: 'Verify CA',
        verifyFull: 'Verify Full'
      }
    },
    redis: {
      title: 'Redis Configuration',
      description: 'Connect to your Redis server',
      host: 'Host',
      port: 'Port',
      username: 'Username (optional)',
      password: 'Password (optional)',
      database: 'Database',
      usernamePlaceholder: 'Leave empty for default user',
      passwordPlaceholder: 'Password',
      enableTls: 'Enable TLS',
      enableTlsHint: 'Use TLS when connecting to Redis (public CA certs)'
    },
    admin: {
      title: 'Admin Account',
      description: 'Create your administrator account',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      passwordPlaceholder: 'Min 8 characters',
      confirmPasswordPlaceholder: 'Confirm password',
      passwordMismatch: 'Passwords do not match'
    },
    ready: {
      title: 'Ready to Install',
      description: 'Review your configuration and complete setup',
      database: 'Database',
      redis: 'Redis',
      adminEmail: 'Admin Email'
    },
    status: {
      testing: 'Testing...',
      success: 'Connection Successful',
      testConnection: 'Test Connection',
      installing: 'Installing...',
      completeInstallation: 'Complete Installation',
      completed: 'Installation completed!',
      redirecting: 'Redirecting to login page...',
      restarting: 'Service is restarting, please wait...',
      timeout: 'Service restart is taking longer than expected. Please refresh the page manually.'
    }
  },

  // Common
}
