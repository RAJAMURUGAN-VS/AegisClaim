import React from 'react'
import { Card } from '../../components/common/Card'

const Analytics: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card
        title="Analytics Dashboard"
        subtitle="Comprehensive PA workflow metrics and insights"
      >
        <div className="p-12 text-center text-gray-500">
          <p>Analytics dashboard will be implemented here</p>
          <p className="mt-2 text-sm">
            This page will display detailed analytics including:
          </p>
          <ul className="mt-4 text-left inline-block space-y-2">
            <li>• Processing time trends</li>
            <li>• Approval/denial rates by service type</li>
            <li>• Agent performance metrics</li>
            <li>• Adjudicator workload distribution</li>
            <li>• Provider submission patterns</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}

export default Analytics
