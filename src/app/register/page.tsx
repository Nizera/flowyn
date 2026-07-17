import { ClientAuthPanel } from '@/components/ClientAuthPanel'

export default async function RegisterPage(props: { searchParams: Promise<{ type?: string, error?: string, ref?: string }> }) {
  const searchParams = await props.searchParams;

  return (
    <ClientAuthPanel
      initialError={searchParams.error}
      initialType={searchParams.type || 'register'}
      referralCode={searchParams.ref || null}
    />
  )
}
