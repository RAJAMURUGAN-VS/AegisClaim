import React from 'react'
import { Card } from '../../components/common/Card'
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  Users,
} from 'lucide-react'

const StatCard: React.FC<{
  title: string
  value: string
  change?: string
  icon: React.ElementType
  color: string
}> = ({ title, value, change, icon: Icon, color }) => (
  <Card className="p-6">
    <div className="flex items-center">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="ml-4">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {change && <p className="text-sm text-success">{change}</p>}
      </div>
    </div>
  </Card>
)

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Requests"
          value="1,248"
          change="+12% from last month"
          icon={FileText}
          color="bg-primary"
        />
        <StatCard
          title="Pending Review"
          value="86"
          icon={Clock}
          color="bg-warning"
        />
        <StatCard
          title="Approved"
          value="892"
          change="71.5% approval rate"
          icon={CheckCircle}
          color="bg-success"
        />
        <StatCard
          title="Denied"
          value="270"
          change="21.6% denial rate"
          icon={XCircle}
          color="bg-danger"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Request Trends" subtitle="Daily submission volume">
          <div className="h-64 flex items-center justify-center text-gray-500">
            <p>Chart will be implemented here using Recharts</p>
          </div>
        </Card>

        <Card title="Status Distribution" subtitle="Current request breakdown">
          <div className="h-64 flex items-center justify-center text-gray-500">
            <p>Chart will be implemented here using Recharts</p>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card title="Recent Activity" subtitle="Latest system events">
        <div className="p-8 text-center text-gray-500">
          <p>Activity feed will be implemented here</p>
        </div>
      </Card>
    </div>
  )
}

export default Dashboard
