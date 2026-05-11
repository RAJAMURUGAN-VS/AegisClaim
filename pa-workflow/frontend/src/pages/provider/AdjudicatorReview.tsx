import React, { useState, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, X, Upload, Calendar, Info } from 'lucide-react'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { Select } from '../../components/common/Select'
import { useNotifications } from '../../hooks/useNotifications'

type FormValues = {
  decision: 'approve' | 'deny' | 'pending' | 'more_info'
  denialReason?: string
  notes?: string
  assignee?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  effectiveDate?: string
  attachments?: File[]
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const DECISIONS = [
  { value: 'approve', label: 'Approve' },
  { value: 'deny', label: 'Deny' },
  { value: 'pending', label: 'Pend (More Review)' },
  { value: 'more_info', label: 'Request More Info' },
]

const AdjudicatorReview: React.FC = () => {
  const navigate = useNavigate()
  const { showNotification } = useNotifications()
  const { control, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      decision: 'pending',
      notes: '',
      assignee: '',
      priority: 'medium',
      effectiveDate: new Date().toISOString().split('T')[0],
      attachments: [],
    },
  })

  const decision = watch('decision')
  const attachments = watch('attachments') || []

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files)
    setValue('attachments', [...attachments, ...arr])
  }, [attachments, setValue])

  const removeAttachment = (index: number) => {
    const next = attachments.filter((_: any, i: number) => i !== index)
    setValue('attachments', next)
  }

  const onSubmit = (data: FormValues) => {
    // Minimal behavior: log and show notification. Integrate backend call as needed.
    console.log('Adjudication submitted:', data)
    showNotification({ type: 'success', title: 'Decision saved', message: 'Adjudication decision was recorded.' })
    navigate(-1)
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <Card title="Adjudication" subtitle="Review the PA request and record your decision">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Submission summary (read-only) */}
            <aside className="lg:col-span-1 bg-neutral-50 border border-neutral-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-neutral-900 mb-2">Submission Summary</h4>
              <div className="text-sm text-neutral-700 space-y-2">
                <div>
                  <div className="text-xs text-neutral-500">Member ID</div>
                  <div className="font-medium">— (load a PA to preview)</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">Payer / Plan</div>
                  <div className="font-medium">—</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">Service Date</div>
                  <div className="font-medium">—</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">Primary ICD-10 / CPT</div>
                  <div className="font-medium">—</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">Clinical Summary</div>
                  <div className="text-sm text-neutral-600 mt-1 leading-snug">Paste or load the PA to view the full clinical summary here.</div>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Load PA</label>
                <div className="flex gap-2">
                  <Input placeholder="Enter PA ID" aria-label="pa id input" />
                  <Button type="button" variant="ghost">Load</Button>
                </div>
              </div>
            </aside>

            {/* Right: Adjudication form */}
            <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  name="decision"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label="Decision"
                      value={field.value}
                      onChange={field.onChange}
                      options={DECISIONS}
                      required
                    />
                  )}
                />

                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label="Priority"
                      value={field.value}
                      onChange={field.onChange}
                      options={PRIORITY_OPTIONS}
                    />
                  )}
                />
              </div>

              {decision === 'deny' && (
                <div>
                  <Controller
                    name="denialReason"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} label="Denial Reason (brief)" placeholder="e.g., Not medically necessary" />
                    )}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">Notes</label>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      rows={5}
                      className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 resize-none focus:outline-none focus:ring-[3px] focus:ring-primary-500/25 focus:border-primary-500"
                      placeholder="Add adjudicator notes, rationale, and any instructions for follow-up."
                    />
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <Controller
                  name="assignee"
                  control={control}
                  render={({ field }) => <Input {...field} label="Assign to" placeholder="Assignee name or email" />}
                />

                <Controller
                  name="effectiveDate"
                  control={control}
                  render={({ field }) => (
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">Effective Date</label>
                      <div className="relative">
                        <input
                          {...field}
                          type="date"
                          className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-[3px] focus:ring-primary-500/25"
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
                      </div>
                    </div>
                  )}
                />
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Attachments</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center">
                    <input type="file" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
                    <span className="px-3 py-2 bg-primary-700 text-white rounded-lg hover:bg-primary-800 transition-colors flex items-center gap-2">
                      <Upload className="w-4 h-4" /> Add files
                    </span>
                  </label>
                  <div className="text-sm text-neutral-500">PDF, JPG, PNG, TIFF. Max 10MB each.</div>
                </div>

                {attachments.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {attachments.map((f: File, i: number) => (
                      <li key={i} className="flex items-center justify-between bg-neutral-50 border border-neutral-200 rounded-lg p-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <CheckCircle2 className="w-4 h-4 text-success-600 flex-shrink-0" />
                          <div className="truncate text-sm">{f.name}</div>
                        </div>
                        <button type="button" onClick={() => removeAttachment(i)} className="p-1 text-neutral-400 hover:text-danger-500">
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-neutral-500 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-500" />
                  Decisions are recorded in the audit trail and notify the provider where applicable.
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
                  <Button type="submit">Save Decision</Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default AdjudicatorReview
