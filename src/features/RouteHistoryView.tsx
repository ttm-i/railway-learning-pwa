import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CalendarDays, ChevronDown, Search, Trash2, X } from 'lucide-react'
import { demoNetwork } from '../data/demoNetwork'
import { findEdge, getStation } from '../domain/graph'
import { getRouteLineIds, matchesRouteQuery } from '../domain/routeHistory'
import { createDeletedRecordTombstone, db } from '../storage/db'

function formatRecordedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '記録日時不明'
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date)
}

export function RouteHistoryView() {
  const history = useLiveQuery(() => db.routeHistory.toArray(), []) ?? []
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const filteredHistory = useMemo(() => history
    .filter((record) => matchesRouteQuery(demoNetwork, record.path, query))
    .sort((a, b) => sort === 'newest'
      ? b.createdAt.localeCompare(a.createdAt)
      : a.createdAt.localeCompare(b.createdAt)), [history, query, sort])

  const deleteRecord = async (id: string) => {
    await db.transaction('rw', [db.routeHistory, db.deletedRecords], async () => {
      await db.routeHistory.delete(id)
      await db.deletedRecords.put(createDeletedRecordTombstone('routeHistory', id))
    })
    if (expandedId === id) setExpandedId(null)
    setPendingDeleteId(null)
  }

  return (
    <div className="history-view">
      <div className="history-tools">
        <label className="history-search"><Search size={17} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="駅名・路線名で探す" />{query && <button aria-label="検索を消す" onClick={() => setQuery('')}><X size={15} aria-hidden="true" /></button>}</label>
        <label className="history-sort">並び順
          <select value={sort} onChange={(event) => setSort(event.target.value as 'newest' | 'oldest')}>
            <option value="newest">新しい順</option>
            <option value="oldest">古い順</option>
          </select>
        </label>
      </div>
      <p className="history-note">確定した記録だけを表示します。自動では削除しません。</p>
      {filteredHistory.length === 0 ? (
        <div className="history-empty">
          <CalendarDays size={28} aria-hidden="true" />
          <strong>{history.length === 0 ? 'まだ確定した経路はありません' : '条件に合う記録がありません'}</strong>
          <span>{history.length === 0 ? 'ゲームで目的地に到着し、「この経路で確定」を押すとここに残ります。' : '検索する駅名や路線名を変えてみてください。'}</span>
        </div>
      ) : filteredHistory.map((record) => {
        const start = getStation(demoNetwork, record.path[0])?.canonicalName ?? '不明な駅'
        const destination = getStation(demoNetwork, record.path[record.path.length - 1])?.canonicalName ?? '不明な駅'
        const lineIds = record.lineIds ?? getRouteLineIds(demoNetwork, record.path)
        const expanded = expandedId === record.id
        const confirmingDelete = pendingDeleteId === record.id
        return (
          <article className="history-card" key={record.id}>
            <div className="history-card__top">
              <span><CalendarDays size={14} aria-hidden="true" />{formatRecordedAt(record.createdAt)}</span>
              <small>{record.datasetVersion === demoNetwork.version ? '現在の架空データ版' : '過去のデータ版'}</small>
            </div>
            <h2>{start}<span>→</span>{destination}</h2>
            <div className="history-lines">
              {lineIds.map((lineId) => {
                const line = demoNetwork.lines.find((item) => item.stableId === lineId)
                return line && <span key={lineId}><i style={{ background: line.color }} />{line.name}</span>
              })}
            </div>
            {(record.viaIds?.length || record.excludedLineIds?.length) && <div className="history-conditions">
              {record.viaIds && record.viaIds.length > 0 && <span><b>経由</b>{record.viaIds.map((id) => getStation(demoNetwork, id)?.canonicalName).join(' → ')}</span>}
              {record.excludedLineIds && record.excludedLineIds.length > 0 && <span><b>不使用</b>{record.excludedLineIds.map((id) => demoNetwork.lines.find((line) => line.stableId === id)?.name).join('・')}</span>}
            </div>}
            <div className="history-metrics">
              <span><strong>{record.metrics.railSegments}</strong>駅間</span>
              <span><strong>{record.metrics.transfers}</strong>乗換</span>
              <span><strong>{record.metrics.revisits}</strong>再訪</span>
              <span><strong>{record.metrics.walks}</strong>徒歩</span>
            </div>
            <button className="history-expand" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : record.id)}>通った順番{expanded ? 'を閉じる' : 'を見る'}<ChevronDown size={17} aria-hidden="true" /></button>
            {expanded && (
              <ol className="history-path">
                {record.path.map((stationId, index) => {
                  const nextId = record.path[index + 1]
                  const edge = nextId ? findEdge(demoNetwork, stationId, nextId) : undefined
                  const line = demoNetwork.lines.find((item) => item.stableId === edge?.lineId)
                  return <li key={`${stationId}-${index}`}><b>{index + 1}</b><span>{getStation(demoNetwork, stationId)?.canonicalName ?? stationId}{line && <small>次は {line.name}</small>}</span></li>
                })}
              </ol>
            )}
            {!confirmingDelete ? (
              <button className="history-delete" onClick={() => setPendingDeleteId(record.id)}><Trash2 size={15} aria-hidden="true" />この記録を削除</button>
            ) : (
              <div className="delete-confirm" role="alertdialog" aria-label="経路記録の削除確認">
                <AlertTriangle size={19} aria-hidden="true" />
                <p><strong>この記録だけを削除しますか？</strong><span>削除すると元に戻せません。</span></p>
                <button onClick={() => setPendingDeleteId(null)}>やめる</button>
                <button className="danger" onClick={() => void deleteRecord(record.id)}>削除する</button>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
