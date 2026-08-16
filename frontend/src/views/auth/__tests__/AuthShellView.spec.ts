import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AuthShellView from '../AuthShellView.vue'

describe('AuthShellView', () => {
  it('keeps the same layout and route stage while authentication children change', async () => {
    const LoginChild = defineComponent({ template: '<div data-testid="login-child">Login</div>' })
    const RegisterChild = defineComponent({ template: '<div data-testid="register-child">Register</div>' })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/auth-entry',
          component: AuthShellView,
          children: [
            { path: '/login', name: 'Login', component: LoginChild },
            { path: '/register', name: 'Register', component: RegisterChild },
            { path: '/auth/callback', name: 'OAuthCallback', component: LoginChild },
          ],
        },
      ],
    })
    await router.push('/login')
    await router.isReady()

    const wrapper = mount(defineComponent({ template: '<RouterView />' }), {
      global: {
        plugins: [router],
        stubs: {
          AuthLayout: {
            props: ['contentWidth'],
            template: '<main :data-content-width="contentWidth"><slot /></main>',
          },
          Transition: false
        }
      }
    })

    expect(wrapper.get('[data-testid="login-child"]').exists()).toBe(true)
    expect(wrapper.get('main').attributes('data-content-width')).toBe('460px')
    const layout = wrapper.get('main').element
    const routeStage = wrapper.get('.auth-route-stage').element

    await router.push('/register')
    await flushPromises()

    expect(wrapper.get('[data-testid="register-child"]').exists()).toBe(true)
    expect(wrapper.get('main').element).toBe(layout)
    expect(wrapper.get('.auth-route-stage').element).toBe(routeStage)

    await router.push('/auth/callback')
    await flushPromises()
    expect(wrapper.get('main').attributes('data-content-width')).toBe('560px')
    expect(wrapper.get('main').element).toBe(layout)
    expect(wrapper.get('.auth-route-stage').element).toBe(routeStage)
  })
})
