import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RealProviderWorkflow from '../../components/workflow/RealProviderWorkflow'

const RealProviderStatus: React.FC = () => {
  const { pa_id } = useParams<{ pa_id: string }>()
  const navigate = useNavigate()

  if (!pa_id) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-2xl">
          <p className="text-lg font-semibold text-slate-50">Missing PA identifier</p>
          <p className="mt-2 text-sm text-slate-400">The workflow pipeline cannot load without a valid prior authorization ID.</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-6 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-700"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  return <RealProviderWorkflow paId={pa_id} onBack={() => navigate(-1)} />
}

export default RealProviderStatus
