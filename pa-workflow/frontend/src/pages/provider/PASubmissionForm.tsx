import React from 'react'
import { Card } from '../../components/common/Card'

const PASubmissionForm: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <Card title="Prior Authorization Request" subtitle="Submit a new PA request">
        <div className="p-12 text-center text-gray-500">
          <p>PA Submission Form will be implemented here.</p>
          <p className="mt-2 text-sm">
            This form will include patient information, service details,
            clinical history, and document upload.
          </p>
        </div>
      </Card>
    </div>
  )
}

export default PASubmissionForm
