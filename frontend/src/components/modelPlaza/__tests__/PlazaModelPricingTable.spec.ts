import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlazaModelPricingTable from '../PlazaModelPricingTable.vue'
import type { PlazaModel } from '@/api/modelPlaza'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

function tokenModel(overrides: Partial<PlazaModel> = {}): PlazaModel {
  return {
    name: 'claude-sonnet',
    platform: 'anthropic',
    pricing: {
      billing_mode: 'token',
      input_price: 3e-6,
      output_price: 1.5e-5,
      cache_write_price: 3.75e-6,
      cache_read_price: 3e-7,
      image_input_price: null,
      image_output_price: null,
      per_request_price: null,
      intervals: []
    },
    official_pricing: {
      input_price: 3e-6,
      output_price: 1.5e-5,
      cache_write_price: 3.75e-6,
      cache_write_1h_price: 6e-6,
      cache_read_price: 3e-7
    },
    ...overrides
  }
}

function mountTable(
  models: PlazaModel[],
  rateMultiplier: number,
  userRateMultiplier?: number | null,
  extraProps?: { imageRateIndependent?: boolean; imageRateMultiplier?: number | null }
) {
  return mount(PlazaModelPricingTable, {
    props: { models, rateMultiplier, userRateMultiplier: userRateMultiplier ?? null, ...extraProps }
  })
}

describe('PlazaModelPricingTable', () => {
  it('倍率为 1 时展示渠道单价原值($/1M),价格保底 2 位小数', () => {
    const wrapper = mountTable([tokenModel()], 1)
    const text = wrapper.text()
    expect(text).toContain('$3.00')
    expect(text).toContain('$15.00')
    // 缓存写 / 读(超过 2 位小数原样保留)
    expect(text).toContain('$3.75')
    expect(text).toContain('$0.30')
    // 倍率列
    expect(text).toContain('1x')
  })

  it('倍率 ≠ 1 时价格列为折后实付价,官方价列保持原价', () => {
    const wrapper = mountTable([tokenModel()], 0.5)
    const text = wrapper.text()
    // 实付 = 3 × 0.5 / 15 × 0.5
    expect(text).toContain('$1.50')
    expect(text).toContain('$7.50')
    // 官方价原值仍在(官方列不乘倍率)
    expect(text).toContain('$3.00')
    expect(text).toContain('$15.00')
    expect(text).toContain('0.5x')
  })

  it('用户专属倍率覆盖分组倍率,并划线展示原倍率', () => {
    const wrapper = mountTable([tokenModel()], 1, 0.8)
    const text = wrapper.text()
    // 实付按 0.8:3 × 0.8 = 2.4
    expect(text).toContain('$2.40')
    expect(text).toContain('$12.00')
    // 倍率列:原倍率划线 + 专属倍率
    const struck = wrapper.find('[data-testid="rate-cell"] .line-through')
    expect(struck.exists()).toBe(true)
    expect(struck.text()).toBe('1x')
    expect(text).toContain('0.8x')
  })

  it('模型按官方输出价从高到低排序,无官方价的排最后', () => {
    const expensive = tokenModel({
      name: 'model-expensive',
      official_pricing: {
        input_price: 1e-5,
        output_price: 7.5e-5,
        cache_write_price: null,
        cache_write_1h_price: null,
        cache_read_price: null
      }
    })
    const cheap = tokenModel({
      name: 'model-cheap',
      official_pricing: {
        input_price: 1e-6,
        output_price: 5e-6,
        cache_write_price: null,
        cache_write_1h_price: null,
        cache_read_price: null
      }
    })
    const noOfficial = tokenModel({ name: 'model-no-official', official_pricing: null })

    const wrapper = mountTable([cheap, noOfficial, expensive], 1)
    const names = wrapper
      .findAll('[data-testid="pricing-row"]')
      .map((row) => row.attributes('data-model'))
    expect(names).toEqual(['model-expensive', 'model-cheap', 'model-no-official'])
  })

  it('官方输出价相同时按模型名降序(新版本号在前)', () => {
    const older = tokenModel({ name: 'gpt-5.5' })
    const newer = tokenModel({ name: 'gpt-5.6-sol' })

    const wrapper = mountTable([older, newer], 1)
    const names = wrapper
      .findAll('[data-testid="pricing-row"]')
      .map((row) => row.attributes('data-model'))
    expect(names).toEqual(['gpt-5.6-sol', 'gpt-5.5'])
  })

  it('按图片/按次计费的模型沉到末尾,不与 token 模型按官方价混排', () => {
    // 官方输出价 $10,介于下面两个 token 模型之间,但因计费模式不同应排最后
    const image = tokenModel({
      name: 'gpt-image-2',
      pricing: {
        billing_mode: 'image',
        input_price: null,
        output_price: null,
        cache_write_price: null,
        cache_read_price: null,
        image_input_price: null,
        image_output_price: null,
        per_request_price: 0.002,
        intervals: []
      },
      official_pricing: {
        input_price: 5e-6,
        output_price: 1e-5,
        cache_write_price: null,
        cache_write_1h_price: null,
        cache_read_price: 1.25e-6
      }
    })
    const pricier = tokenModel({
      name: 'gpt-5.6-terra',
      official_pricing: {
        input_price: 2.5e-6,
        output_price: 1.5e-5,
        cache_write_price: null,
        cache_write_1h_price: null,
        cache_read_price: null
      }
    })
    const cheaper = tokenModel({
      name: 'gpt-5.6-luna',
      official_pricing: {
        input_price: 1e-6,
        output_price: 6e-6,
        cache_write_price: null,
        cache_write_1h_price: null,
        cache_read_price: null
      }
    })

    const wrapper = mountTable([pricier, image, cheaper], 1)
    const names = wrapper
      .findAll('[data-testid="pricing-row"]')
      .map((row) => row.attributes('data-model'))
    expect(names[0]).toBe('gpt-5.6-terra')
    expect(names[1]).toBe('gpt-5.6-luna')
    expect(names[2]).toBe('gpt-image-2')
  })

  it('两级表头:实付区与官方区各拆输入/输出/缓存列', () => {
    const wrapper = mountTable([tokenModel()], 1)
    const text = wrapper.text()
    expect(text).toContain('modelPlaza.table.paidPrice')
    expect(text).toContain('modelPlaza.table.officialPrice')
    expect(wrapper.find('[data-testid="pricing-desktop-head"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="paid-price-band"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="official-price-band"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rate-cell"]').exists()).toBe(true)
  })

  it('官方价包含 1h 缓存写入价;official_pricing 为 null 时官方三列显示 -', () => {
    const withOfficial = mountTable([tokenModel()], 1)
    expect(withOfficial.text()).toContain('$6.00')
    expect(withOfficial.text()).toContain('(1h')

    const withoutOfficial = mountTable([tokenModel({ official_pricing: null })], 1)
    const officialBand = withoutOfficial.find('[data-testid="official-price-band"]')
    expect(officialBand.find('.official-input strong').text().trim()).toBe('-')
    expect(officialBand.find('.official-output strong').text().trim()).toBe('-')
    expect(officialBand.find('.official-cache strong').text().trim()).toBe('-')
  })

  it('per_request 模型按单次价 × 倍率展示,官方价列显示 -', () => {
    const model = tokenModel({
      name: 'search-tool',
      pricing: {
        billing_mode: 'per_request',
        input_price: null,
        output_price: null,
        cache_write_price: null,
        cache_read_price: null,
        image_input_price: null,
        image_output_price: null,
        per_request_price: 0.04,
        intervals: []
      },
      official_pricing: null
    })
    const wrapper = mountTable([model], 0.5)
    const text = wrapper.text()
    // 0.04 × 0.5 = 0.02,scale=1
    expect(text).toContain('$0.02')
    expect(text).toContain('modelPlaza.table.perRequest')
    expect(text).toContain('modelPlaza.table.perRequestPrice')
    // 单位后缀跟在价格后(按次 → / 次)
    expect(text).toContain('modelPlaza.table.perUnitRequest')
    expect(wrapper.find('.official-wide').text()).toBe('-')
  })

  it('token 模型阶梯定价内联进输入/输出列,按倍率折算', () => {
    const model = tokenModel({
      pricing: {
        billing_mode: 'token',
        input_price: 3e-6,
        output_price: 1.5e-5,
        cache_write_price: null,
        cache_read_price: null,
        image_input_price: null,
        image_output_price: null,
        per_request_price: null,
        intervals: [
          {
            min_tokens: 0,
            max_tokens: 200000,
            tier_label: '',
            input_price: 3e-6,
            output_price: 1.5e-5,
            cache_write_price: null,
            cache_read_price: null,
            per_request_price: null
          },
          {
            min_tokens: 200000,
            max_tokens: null,
            tier_label: '',
            input_price: 6e-6,
            output_price: 3e-5,
            cache_write_price: null,
            cache_read_price: null,
            per_request_price: null
          }
        ]
      }
    })
    const wrapper = mountTable([model], 0.5)
    const text = wrapper.text()
    // 区间标签按 token 数生成
    expect(text).toContain('≤200K')
    expect(text).toContain('>200K')
    // 折后:输入 1.5 / 3,输出 7.5 / 15
    expect(text).toContain('$1.50')
    expect(text).toContain('$7.50')
    expect(text).toContain('$15.00')
    const mobileTiers = wrapper.find('[data-testid="token-tier-list"]')
    expect(mobileTiers.findAll('.token-tier-row')).toHaveLength(2)
    expect(mobileTiers.text()).toContain('modelPlaza.table.input')
    expect(mobileTiers.text()).toContain('modelPlaza.table.output')
  })

  it('生图独立倍率开启时,按图价格乘独立倍率且倍率列展示独立倍率', () => {
    const model = tokenModel({
      name: 'gpt-image-2',
      pricing: {
        billing_mode: 'image',
        input_price: null,
        output_price: null,
        cache_write_price: null,
        cache_read_price: null,
        image_input_price: null,
        image_output_price: null,
        per_request_price: null,
        intervals: [
          {
            min_tokens: 0,
            max_tokens: null,
            tier_label: '1K',
            input_price: null,
            output_price: null,
            cache_write_price: null,
            cache_read_price: null,
            per_request_price: 0.02
          }
        ]
      },
      official_pricing: null
    })
    const wrapper = mountTable([model], 0.1, null, {
      imageRateIndependent: true,
      imageRateMultiplier: 1
    })

    expect(wrapper.text()).toContain('$0.02')
    expect(wrapper.text()).not.toContain('$0.002')
    expect(wrapper.get('[data-testid="rate-cell"]').get('strong').text()).toBe('1x')
  })

  it('生图独立倍率关闭时,按图价格仍使用分组生效倍率', () => {
    const model = tokenModel({
      name: 'gpt-image-2',
      pricing: {
        billing_mode: 'image',
        input_price: null,
        output_price: null,
        cache_write_price: null,
        cache_read_price: null,
        image_input_price: null,
        image_output_price: null,
        per_request_price: 0.2,
        intervals: []
      },
      official_pricing: null
    })
    const wrapper = mountTable([model], 0.1, null, { imageRateIndependent: false })

    expect(wrapper.text()).toContain('$0.02')
    expect(wrapper.get('[data-testid="rate-cell"]').get('strong').text()).toBe('0.1x')
  })

  it('按图模型主行展示纵向阶梯价格,不把 image_output_price(每 token)当按次价', () => {
    const model = tokenModel({
      name: 'gpt-image-2',
      pricing: {
        billing_mode: 'image',
        input_price: null,
        output_price: null,
        cache_write_price: null,
        cache_read_price: null,
        image_input_price: null,
        // 每 token 图片输出价:不应被当作按次单价展示
        image_output_price: 3e-5,
        per_request_price: null,
        intervals: [
          {
            min_tokens: 0,
            max_tokens: null,
            tier_label: '1K',
            input_price: null,
            output_price: null,
            cache_write_price: null,
            cache_read_price: null,
            per_request_price: 0.01
          },
          {
            min_tokens: 0,
            max_tokens: null,
            tier_label: '2K',
            input_price: null,
            output_price: null,
            cache_write_price: null,
            cache_read_price: null,
            per_request_price: 0.02
          }
        ]
      },
      official_pricing: null
    })
    const wrapper = mountTable([model], 0.1)
    const text = wrapper.text()
    expect(text).toContain('modelPlaza.table.perImage')
    expect(text).toContain('modelPlaza.table.perImagePrice')
    // 价格行:1K $0.001 / 2K $0.002,单位后缀内嵌(按图 → / 张)
    expect(text).toContain('1K')
    expect(text).toContain('$0.001')
    expect(text).toContain('2K')
    expect(text).toContain('$0.002')
    expect(text).toContain('modelPlaza.table.perUnitImage')
    expect(wrapper.findAll('.request-tier')).toHaveLength(2)
    // 旧 bug:image_output_price × 0.1 = 0.000003 被当按次价
    expect(text).not.toContain('$0.000003')
  })

  it('手机端保留完整列表列并由价格表自身横向滚动,不固定模型列', () => {
    const longName = 'provider-model-with-a-very-long-version-and-capability-suffix'
    const wrapper = mountTable([tokenModel({ name: longName })], 1)
    const surface = wrapper.find('[data-testid="pricing-responsive"]')
    const row = wrapper.find('[data-testid="pricing-row"]')
    const modelName = row.find('.model-name')

    expect(surface.classes()).toContain('overflow-x-auto')
    expect(wrapper.find('table').exists()).toBe(false)
    expect(row.exists()).toBe(true)
    expect(row.findAll('.price-band')).toHaveLength(2)
    expect(modelName.text()).toBe(longName)
    expect(modelName.attributes('title')).toBe(longName)
    expect(modelName.classes()).toContain('min-w-0')
  })
})
