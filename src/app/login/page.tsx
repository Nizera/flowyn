import { ClientAuthPanel } from '@/components/ClientAuthPanel'

export default async function LoginPage(props: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const searchParams = await props.searchParams;

  return (
    <ClientAuthPanel initialError={searchParams.error} initialType="login" initialSuccess={searchParams.success} />
  )
}
