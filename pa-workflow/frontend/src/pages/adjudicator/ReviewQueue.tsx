import React from 'react'
import { Card } from '../../components/common/Card'

const ReviewQueue: React.FC = () => {
  return (
    <div>
      <Card title="Review Queue" subtitle="Prior authorization requests awaiting review">
        <div className="p-12 text-center text-gray-500">
          <p>Review Queue will be implemented here.</p>
          <p className="mt-2 text-sm">
            This page will display a table of PA requests sorted by priority,
            with filtering, sorting, and quick action capabilities.
          </p>
        </div>
      </Card>
    </div>
  )
}

export default ReviewQueue
