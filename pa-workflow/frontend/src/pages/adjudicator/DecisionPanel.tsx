import React from 'react'
import { Card } from '../../components/common/Card'

const DecisionPanel: React.FC = () => {
  return (
    <Card title="Decision Panel" subtitle="Make approval or denial decisions">
      <div className="p-12 text-center text-gray-500">
        <p>Decision Panel component will be implemented here.</p>
        <p className="mt-2 text-sm">
          This component will allow adjudicators to approve, deny, or pend
          requests with supporting documentation and reasoning.
        </p>
      </div>
    </Card>
  )
}

export default DecisionPanel
