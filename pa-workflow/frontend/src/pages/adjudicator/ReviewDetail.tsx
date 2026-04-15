import React from 'react'
import { useParams } from 'react-router-dom'
import { Card } from '../../components/common/Card'

const ReviewDetail: React.FC = () => {
  const { pa_id } = useParams<{ pa_id: string }>()

  return (
    <div className="max-w-6xl mx-auto">
      <Card title={`Review PA Request #${pa_id}`}>
        <div className="p-12 text-center text-gray-500">
          <p>Review Detail page will be implemented here.</p>
          <p className="mt-2 text-sm">
            This page will show all PA details, agent analysis results,
            scoring output, and the decision panel for adjudicators.
          </p>
        </div>
      </Card>
    </div>
  )
}

export default ReviewDetail
