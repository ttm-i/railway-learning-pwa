import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CircleCheck, CircleX, RotateCcw } from 'lucide-react'
import { RailMap } from '../components/RailMap'
import { demoNetwork } from '../data/demoNetwork'
import { getStation } from '../domain/graph'
import type { StableId } from '../domain/types'
import { db } from '../storage/db'

interface Question {
  id: string
  prompt: string
  answerId: StableId
  focusId: StableId
}

const questions: Question[] = [
  { id: 'q-ao-1', prompt: '春風駅から、あおぞら線で次の駅は？', answerId: 'demo:station:midori', focusId: 'demo:station:harukaze' },
  { id: 'q-ao-2', prompt: 'ひかり台駅から、みなと方面の次の駅は？', answerId: 'demo:station:minato', focusId: 'demo:station:hikari' },
  { id: 'q-yu-1', prompt: 'こもれび駅から、さくら野方面の次の駅は？', answerId: 'demo:station:midori', focusId: 'demo:station:komorebi' }
]

export function QuizTab() {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<StableId | null>(null)
  const question = questions[index % questions.length]
  const answers = useLiveQuery(() => db.quizAnswers.toArray(), []) ?? []
  const options = useMemo(() => {
    const decoys = demoNetwork.stations.filter((station) => station.stableId !== question.answerId).slice(index, index + 3)
    const answer = getStation(demoNetwork, question.answerId)!
    return [answer, ...decoys].sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, 'ja'))
  }, [index, question.answerId])

  const answer = async (stationId: StableId) => {
    if (selected) return
    setSelected(stationId)
    await db.quizAnswers.add({
      id: crypto.randomUUID(),
      questionId: question.id,
      answeredAt: new Date().toISOString(),
      answer: stationId,
      correct: stationId === question.answerId,
      datasetVersion: demoNetwork.version
    })
  }

  const next = () => {
    setIndex((value) => (value + 1) % questions.length)
    setSelected(null)
  }

  const correctCount = answers.filter((item) => item.correct).length

  return (
    <section className="screen" aria-labelledby="quiz-title">
      <header className="screen-heading">
        <div><span className="eyebrow">駅順を覚える</span><h1 id="quiz-title">基本クイズ</h1></div>
        <span className="data-pill">4択</span>
      </header>
      <div className="progress-card"><span>これまでの結果</span><strong>{answers.length ? `${correctCount} / ${answers.length} 正解` : 'まだ回答はありません'}</strong></div>
      <RailMap selectedStationId={selected ?? question.focusId} />
      <article className="quiz-card">
        <span className="question-count">問題 {(index % questions.length) + 1} / {questions.length}</span>
        <h2>{question.prompt}</h2>
        <div className="answer-grid">
          {options.map((station) => {
            const isCorrect = selected && station.stableId === question.answerId
            const isWrong = selected === station.stableId && station.stableId !== question.answerId
            return (
              <button key={station.stableId} disabled={Boolean(selected)} className={`${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`} onClick={() => answer(station.stableId)}>
                {isCorrect && <CircleCheck size={18} aria-hidden="true" />}
                {isWrong && <CircleX size={18} aria-hidden="true" />}
                {station.canonicalName}
              </button>
            )
          })}
        </div>
        {selected && (
          <div className={`answer-result ${selected === question.answerId ? 'success' : 'error'}`} aria-live="polite">
            <strong>{selected === question.answerId ? '正解です！' : '今回は違います'}</strong>
            <span>正解は「{getStation(demoNetwork, question.answerId)?.canonicalName}」です。</span>
            <button className="primary-button" onClick={next}>次の問題へ</button>
          </div>
        )}
        {!selected && <p className="subtle-note"><RotateCcw size={15} aria-hidden="true" />時間制限はありません。落ち着いて選べます。</p>}
      </article>
    </section>
  )
}
