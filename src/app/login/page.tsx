import { ClientAuthPanel } from '@/components/ClientAuthPanel'
import { isSafeRedirectPath } from '@/lib/validation'

export default async function LoginPage(props: { searchParams: Promise<{ error?: string; success?: string; redirect?: string }> }) {
  const searchParams = await props.searchParams;
  const redirectTo = isSafeRedirectPath(searchParams.redirect) ? searchParams.redirect! : '/learn'

  return (
    <ClientAuthPanel
      initialError={searchParams.error}
      initialType="login"
      initialSuccess={searchParams.success}
      redirectTo={redirectTo}
    />
  )
}
