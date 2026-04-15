import React from 'react'
import { Card } from '../../components/common/Card'
import { Table } from '../../components/common/Table'
import type { PARequest, PaginatedResponse } from '../../types/pa.types'

const PAList: React.FC = () => {
  const mockData: PARequest[] = [
    {
      id: 'PA-2024-001',
      providerId: 'PROV001',
      patientId: 'PAT001',
      patientName: 'John Doe',
      patientDOB: '1985-03-15',
      memberId: 'M123456',
      insurancePlan: 'Gold Plan',
      providerNPI: '1234567890',
      providerName: 'Dr. Sarah Smith',
      providerPhone: '555-123-4567',
      providerFax: '555-123-4568',
      serviceType: 'MEDICAL',
      procedureCodes: ['99213', '99214'],
      diagnosisCodes: ['J45.901'],
      clinicalHistory: '',
      previousTreatments: '',
      symptoms: '',
      durationOfSymptoms: '',
      urgencyLevel: 'ROUTINE',
      requestedDate: '2024-03-01',
      status: 'SUBMITTED',
      submittedAt: '2024-03-01T10:00:00Z',
      updatedAt: '2024-03-01T10:00:00Z',
    },
  ]

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
