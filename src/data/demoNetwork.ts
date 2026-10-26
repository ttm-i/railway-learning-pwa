import type { DemoDataset, RailEdge, StableId } from '../domain/types'

const edge = (id: string, from: StableId, to: StableId, lineId: StableId): RailEdge => ({
  stableId: `demo:edge:${id}`,
  from,
  to,
  kind: 'rail',
  lineId,
  confirmationStatus: 'confirmed'
})

export const demoNetwork: DemoDataset = {
  version: 'demo-2026-10-26-v1',
  publicationDate: '2026-10-26',
  fictional: true,
  notice: 'この路線・駅は動作確認用の架空データです。実在の鉄道とは関係ありません。',
  operators: [{ stableId: 'demo:operator:kisetsu', displayName: 'きせつ鉄道（架空）' }],
  lines: [
    {
      stableId: 'demo:line:aozora',
      operatorId: 'demo:operator:kisetsu',
      name: 'あおぞら線',
      color: '#157A8A',
      stationIds: [
        'demo:station:harukaze',
        'demo:station:midori',
        'demo:station:hikari',
        'demo:station:minato'
      ]
    },
    {
      stableId: 'demo:line:yuhi',
      operatorId: 'demo:operator:kisetsu',
      name: 'ゆうひ線',
      color: '#D5683C',
      stationIds: [
        'demo:station:sakura',
        'demo:station:midori',
        'demo:station:komorebi',
        'demo:station:hoshimi'
      ]
    }
  ],
  stations: [
    { stableId: 'demo:station:harukaze', canonicalName: '春風', x: 60, y: 214 },
    { stableId: 'demo:station:midori', canonicalName: 'みどり中央', x: 152, y: 176 },
    { stableId: 'demo:station:hikari', canonicalName: 'ひかり台', x: 250, y: 136 },
    { stableId: 'demo:station:minato', canonicalName: 'みなと', x: 344, y: 98 },
    { stableId: 'demo:station:sakura', canonicalName: 'さくら野', x: 90, y: 72 },
    { stableId: 'demo:station:komorebi', canonicalName: 'こもれび', x: 236, y: 240 },
    { stableId: 'demo:station:hoshimi', canonicalName: '星見ヶ丘', x: 322, y: 292 }
  ],
  edges: [
    edge('ao-1', 'demo:station:harukaze', 'demo:station:midori', 'demo:line:aozora'),
    edge('ao-2', 'demo:station:midori', 'demo:station:hikari', 'demo:line:aozora'),
    edge('ao-3', 'demo:station:hikari', 'demo:station:minato', 'demo:line:aozora'),
    edge('yu-1', 'demo:station:sakura', 'demo:station:midori', 'demo:line:yuhi'),
    edge('yu-2', 'demo:station:midori', 'demo:station:komorebi', 'demo:line:yuhi'),
    edge('yu-3', 'demo:station:komorebi', 'demo:station:hoshimi', 'demo:line:yuhi')
  ]
}
