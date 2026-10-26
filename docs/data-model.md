# データモデル・永続化

## 鉄道データ（参照・バージョン管理）
- `dataset`: version, publicationDate, loadedAt, integrityHash, licensingRefs, changelog。
- `operator`: stableId, displayName, refs。
- `line`: stableId, operatorId, name, color, status, officialRefs, verifiedAt。
- `station`: stableId, canonicalName, aliases, lat/lon or display geometry, status, migrationId, officialRefs。
- `line_station`: lineId, stationId, order, isTerminus（分岐線等は単純な一直線駅順に限定しない）。
- `edge`: stableId, from/to IDs, kind rail/inStationTransfer/walk, line/service references, confirmationStatus, sourceRef, verifiedAt。
- `service_pattern`: stableId, line/through-service IDs, train type, ordered stopping station IDs, evidence, verifiedAt, optional applicable dates。静的パターンは実時刻表の代替ではない。
- `lineShape`: rendered geometry and label positions, linked stable IDs, separate from route graph。
- 駅新設・統廃合・名称変更ではIDマッピングを実施。現行の学習達成率に廃止駅を黙って混入しないが、歴史記録は保持。

## ユーザー側（IndexedDB）
- `settings`: studyRegions, theme, nameVisibility, geographyLayers, lastMapView, lastQuizOptions, lastRouteOptions, onboardingComplete。
- `manualMastery`: key = stationId or (lineId,stationId), learned, updatedAt。
- `quizAnswers`: UUID, questionId/seed, format, answeredAt, answer, correct, retryOf, datasetVersion。
- `autoMastery`: computed station/line scope, recency/streak/interval evidence; manualMasteryとは独立。
- `quizSuspension`: full pending question set and progress; maximum one active。
- `routeSuspension`: full game state, scenario/version, path steps, conditions/hints/view; maximum one active。
- `routeHistory`: immutable result UUID, createdAt, datasetVersion, conditions, ordered traversals, service transitions, metrics, successState, latestValidationResult (optional, separately saved)。
- `favorites`: named quiz/route presets, IDs and user-editable metadata。
- `backupMetadata`: export attempts (not proof of external file completion), reminders, lastImport, beforeImportSnapshot reference。
- `deletedRecordTombstones`: UUID, deletedAt, type — merge時の削除済み履歴復活を避けるための設計候補（実装方針はopen-issues）。

## 保存の原則
- ネットワーク更新とユーザー記録更新は別トランザクション。壊れたネットワーク更新はロールバック。
- エクスポートJSONに `schemaVersion`, `exportedAt`, `appVersion`, `data` とデータ種別を含める。未知/旧スキーマを安全に検出。
- 端末のファイル保存が完了したかをWebアプリ側で判定できない場合、「書き出し完了」と断定しない。
