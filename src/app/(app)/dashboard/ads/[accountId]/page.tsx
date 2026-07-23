import { Suspense } from 'react'
import CampaignManagementPageInner from './CampaignManagementClient'

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
    </div>
  )
}

export default function CampaignManagementPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CampaignManagementPageInner />
    </Suspense>
  )
}
