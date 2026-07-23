import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('loads and shows main content', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Flowyn')).toBeVisible()
    await expect(page.locator('text=R$ 97')).toBeVisible()
  })

  test('has working navigation links', async ({ page }) => {
    await page.goto('/')
    const loginLink = page.locator('a[href="/login"]')
    await expect(loginLink.first()).toBeVisible()
  })

  test('footer has legal links', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('a[href="/terms"]')).toBeVisible()
    await expect(page.locator('a[href="/privacy"]')).toBeVisible()
    await expect(page.locator('a[href="/contato"]')).toBeVisible()
  })

  test('chatbot widget is present', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('button').filter({ has: page.locator('svg') })).toBeVisible()
  })
})

test.describe('Public Pages', () => {
  test('terms page loads', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.locator('text=Termos de Serviço')).toBeVisible()
  })

  test('privacy page loads', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.locator('text=Política de Privacidade')).toBeVisible()
  })

  test('contact page loads', async ({ page }) => {
    await page.goto('/contato')
    await expect(page.locator('text=Contato')).toBeVisible()
    await expect(page.locator('text=suporte@flowyn.com.br')).toBeVisible()
  })
})

test.describe('Auth Pages', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('text=Acesse sua conta')).toBeVisible()
  })

  test('register page loads', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('text=Crie sua conta')).toBeVisible()
  })

  test('register links to terms', async ({ page }) => {
    await page.goto('/register')
    const termsLink = page.locator('a[href="/terms"]')
    await expect(termsLink).toBeVisible()
  })

  test('forgot password page loads', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.locator('text=Esqueceu')).toBeVisible()
  })
})

test.describe('404 Page', () => {
  test('shows custom 404 for unknown routes', async ({ page }) => {
    const response = await page.goto('/this-does-not-exist')
    expect(response?.status()).toBe(404)
    await expect(page.locator('text=404')).toBeVisible()
    await expect(page.locator('text=Página não encontrada')).toBeVisible()
  })
})

test.describe('Cookie Consent', () => {
  test('shows cookie consent banner on first visit', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Cookies e Privacidade')).toBeVisible()
    await expect(page.locator('button:text("Aceitar")')).toBeVisible()
  })

  test('hides banner after accepting', async ({ page }) => {
    await page.goto('/')
    await page.click('button:text("Aceitar")')
    await expect(page.locator('text=Cookies e Privacidade')).not.toBeVisible()
  })
})
