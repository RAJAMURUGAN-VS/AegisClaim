import React from 'react'
import { Card } from '../../components/common/Card'

const PAList: React.FC = () => {
  return (
    <div>
      <Card
        title="All PA Requests"
        subtitle="View and manage all prior authorization requests"
      >
        <div className="p-8 text-center text-gray-500">
          <p>PA List table will be implemented here</p>
          <p className="mt-2 text-sm">
            This will include advanced filtering, sorting, pagination,
            and bulk action capabilities for administrators.
          </p>
        </div>
      </Card>
    </div>
  )
}

export default PAList
