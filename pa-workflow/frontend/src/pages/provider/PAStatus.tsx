import React from 'react'
import { useParams } from 'react-router-dom'
import { Card } from '../../components/common/Card'

const PAStatus: React.FC = () => {
  const { pa_id } = useParams<{ pa_id: string }>()

  return (
    <div className="max-w-4xl mx-auto">
      <Card title={`PA Request #${pa_id}`} subtitle="Track your request status">
        <div className="p-12 text-center text-gray-500">
          <p>PA Status page will be implemented here.</p>
          <p className="mt-2 text-sm">
            This page will display the current status, timeline, agent outputs,
            and final decision for the PA request.
          </p>
        </div>
      </Card>
    </div>
  )
}

export default PAStatus
