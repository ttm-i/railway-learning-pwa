import { FlaskConical } from 'lucide-react'
import { demoNetwork } from '../data/demoNetwork'

export function DemoNotice() {
  return (
    <aside className="demo-notice" aria-label="データに関する注意">
      <FlaskConical size={18} aria-hidden="true" />
      <span><strong>架空データで試験中</strong> — {demoNetwork.notice}</span>
    </aside>
  )
}
