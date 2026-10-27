import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CircleCheck, CircleX, Keyboard, ListChecks, MapPinned, Play, RotateCcw } from 'lucide-react'
import { RailMap } from '../components/RailMap'
import { demoNetwork } from '../data/demoNetwork'
import { getStation } from '../domain/graph'
import { canRestoreQuiz, evaluateStationText, getQuestion, quizQuestions, type QuizFormat } from '../domain/quiz'
import type { StableId } from '../domain/types'
import { db } from '../storage/db'

const questionIds = quizQuestions.map((question) => question.id)

export function QuizTab() {
  const saved = useLiveQuery(() => db.quizSuspension.get('active'), [], null)
  const answers = useLiveQuery(() => db.quizAnswers.toArray(), []) ?? []
  const [ready, setReady] = useState(false)
  const [resumed, setResumed] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [index, setIndex] = useState(0)
  const [format, setFormat] = useState<QuizFormat>('choice')
  const [selected, setSelected] = useState<StableId | null>(null)
  const [textAnswer, setTextAnswer] = useState('')
  const [textAnswerCorrect, setTextAnswerCorrect] = useState<boolean | null>(null)
  const [pendingTextConfirmation, setPendingTextConfirmation] = useState(false)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const hasAnswered = Boolean(selected) || textAnswerCorrect !== null

  useEffect(() => {
    if (ready || saved === null) return
    if (saved && canRestoreQuiz(saved, demoNetwork.version)) {
      setIndex(saved.currentIndex)
      setFormat(saved.format)
      setSelected(saved.selectedAnswerId ?? null)
      setTextAnswer(saved.textDraft ?? '')
      setTextAnswerCorrect(saved.textAnswerCorrect ?? null)
      setSessionCorrect(saved.correctCount)
      setResumed(true)
    }
    setReady(true)
  }, [ready, saved])

  useEffect(() => {
    if (!ready || completed) return
    void db.quizSuspension.put({
      id: 'active',
      questionIds,
      currentIndex: index,
      format,
      selectedAnswerId: selected ?? undefined,
      textDraft: textAnswer || undefined,
      textAnswerCorrect: textAnswerCorrect ?? undefined,
      correctCount: sessionCorrect,
      datasetVersion: demoNetwork.version,
      updatedAt: new Date().toISOString()
    })
  }, [ready, completed, index, format, selected, textAnswer, textAnswerCorrect, sessionCorrect])

  const question = getQuestion(questionIds[index]) ?? quizQuestions[0]
  const options = useMemo(() => {
    const decoys = demoNetwork.stations.filter((station) => station.stableId !== question.answerId)
    const rotated = [...decoys.slice(index), ...decoys.slice(0, index)].slice(0, 3)
    const answerStation = getStation(demoNetwork, question.answerId)!
    return [answerStation, ...rotated].sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, 'ja'))
  }, [index, question.answerId])

  const answer = async (stationId: StableId) => {
    if (!ready || hasAnswered) return
    const correct = stationId === question.answerId
    const nextCorrectCount = sessionCorrect + (correct ? 1 : 0)
    await db.quizAnswers.add({
      id: crypto.randomUUID(),
      questionId: question.id,
      answeredAt: new Date().toISOString(),
      answer: stationId,
      correct,
      datasetVersion: demoNetwork.version
    })
    setSelected(stationId)
    setSessionCorrect(nextCorrectCount)
    setResumed(false)
    await db.quizSuspension.put({
      id: 'active', questionIds, currentIndex: index, format, selectedAnswerId: stationId,
      textDraft: textAnswer || undefined,
      correctCount: nextCorrectCount, datasetVersion: demoNetwork.version, updatedAt: new Date().toISOString()
    })
  }

  const recordTextAnswer = async (correct: boolean) => {
    if (!ready || hasAnswered) return
    const matchedStation = demoNetwork.stations.find((station) => evaluateStationText(textAnswer, station) === 'correct')
    const selectedAnswerId = correct ? question.answerId : matchedStation?.stableId
    const nextCorrectCount = sessionCorrect + (correct ? 1 : 0)
    await db.quizAnswers.add({
      id: crypto.randomUUID(),
      questionId: question.id,
      answeredAt: new Date().toISOString(),
      ...(selectedAnswerId ? { answer: selectedAnswerId } : {}),
      textAnswer,
      correct,
      datasetVersion: demoNetwork.version
    })
    setSelected(selectedAnswerId ?? null)
    setTextAnswerCorrect(correct)
    setPendingTextConfirmation(false)
    setSessionCorrect(nextCorrectCount)
    setResumed(false)
    await db.quizSuspension.put({
      id: 'active', questionIds, currentIndex: index, format,
      selectedAnswerId, textDraft: textAnswer, textAnswerCorrect: correct,
      correctCount: nextCorrectCount, datasetVersion: demoNetwork.version, updatedAt: new Date().toISOString()
    })
  }

  const submitTextAnswer = () => {
    const answerStation = getStation(demoNetwork, question.answerId)!
    const evaluation = evaluateStationText(textAnswer, answerStation)
    if (evaluation === 'confirm') {
      setPendingTextConfirmation(true)
      return
    }
    void recordTextAnswer(evaluation === 'correct')
  }

  const next = async () => {
    if (index === questionIds.length - 1) {
      await db.quizSuspension.delete('active')
      setCompleted(true)
      setSelected(null)
      return
    }
    setIndex((value) => value + 1)
    setSelected(null)
    setTextAnswer('')
    setTextAnswerCorrect(null)
    setPendingTextConfirmation(false)
    setResumed(false)
  }

  const startAgain = () => {
    setIndex(0)
    setFormat('choice')
    setSelected(null)
    setTextAnswer('')
    setTextAnswerCorrect(null)
    setPendingTextConfirmation(false)
    setSessionCorrect(0)
    setCompleted(false)
    setResumed(false)
  }

  const totalCorrect = answers.filter((item) => item.correct).length
  const isCorrect = format === 'text' ? textAnswerCorrect === true : selected === question.answerId

  if (!ready) {
    return <section className="screen"><div className="loading-card">クイズを準備しています…</div></section>
  }

  if (completed) {
    return (
      <section className="screen" aria-labelledby="quiz-title">
        <header className="screen-heading">
          <div><span className="eyebrow">駅順を覚える</span><h1 id="quiz-title">基本クイズ</h1></div>
        </header>
        <article className="quiz-complete">
          <div className="complete-mark"><CircleCheck size={34} aria-hidden="true" /></div>
          <span className="eyebrow">3問完了</span>
          <h2>{sessionCorrect} / {questionIds.length} 正解</h2>
          <p>未回答の問題は不正解にしていません。今回の回答だけが記録されています。</p>
          <button className="primary-button" onClick={startAgain}><Play size={18} aria-hidden="true" />もう一度挑戦</button>
        </article>
      </section>
    )
  }

  return (
    <section className="screen" aria-labelledby="quiz-title">
      <header className="screen-heading">
        <div><span className="eyebrow">駅順を覚える</span><h1 id="quiz-title">基本クイズ</h1></div>
        <span className="data-pill">{format === 'choice' ? '4択' : format === 'map' ? '地図タップ' : '駅名入力'}</span>
      </header>
      <div className="progress-card"><span>これまでの結果</span><strong>{answers.length ? `${totalCorrect} / ${answers.length} 正解` : 'まだ回答はありません'}</strong></div>
      {resumed && <div className="resume-banner"><RotateCcw size={16} aria-hidden="true" />前回の続きから再開しました</div>}
      <div className="quiz-format" aria-label="回答方法">
        <button className={format === 'choice' ? 'active' : ''} disabled={hasAnswered} onClick={() => setFormat('choice')}><ListChecks size={17} aria-hidden="true" />4択</button>
        <button className={format === 'map' ? 'active' : ''} disabled={hasAnswered} onClick={() => setFormat('map')}><MapPinned size={17} aria-hidden="true" />地図</button>
        <button className={format === 'text' ? 'active' : ''} disabled={hasAnswered} onClick={() => setFormat('text')}><Keyboard size={17} aria-hidden="true" />駅名入力</button>
      </div>
      <RailMap selectedStationId={hasAnswered ? question.answerId : question.focusId} onSelectStation={format === 'map' && !hasAnswered ? answer : undefined} />
      <article className="quiz-card">
        <span className="question-count">問題 {index + 1} / {questionIds.length}</span>
        <h2>{question.prompt}</h2>
        {format === 'choice' ? (
          <div className="answer-grid">
            {options.map((station) => {
              const optionCorrect = selected && station.stableId === question.answerId
              const optionWrong = selected === station.stableId && station.stableId !== question.answerId
              return (
                <button key={station.stableId} disabled={Boolean(selected)} className={`${optionCorrect ? 'correct' : ''} ${optionWrong ? 'wrong' : ''}`} onClick={() => answer(station.stableId)}>
                  {optionCorrect && <CircleCheck size={18} aria-hidden="true" />}
                  {optionWrong && <CircleX size={18} aria-hidden="true" />}
                  {station.canonicalName}
                </button>
              )
            })}
          </div>
        ) : format === 'map' ? (
          <div className="map-answer-help"><MapPinned size={19} aria-hidden="true" /><span>路線図の駅を1つ選んでください。</span></div>
        ) : (
          <div className="text-answer-area">
            <form onSubmit={(event) => { event.preventDefault(); submitTextAnswer() }}>
              <label htmlFor="station-text-answer">駅名を入力してください</label>
              <div><input id="station-text-answer" autoComplete="off" enterKeyHint="done" value={textAnswer} disabled={hasAnswered} onChange={(event) => { setTextAnswer(event.target.value); setPendingTextConfirmation(false) }} placeholder="例：みどり中央駅" /><button disabled={hasAnswered || !textAnswer.trim()} type="submit">回答する</button></div>
            </form>
            {pendingTextConfirmation && <div className="text-answer-confirm" role="alert">
              <strong>「{getStation(demoNetwork, question.answerId)?.canonicalName}」のつもりで入力しましたか？</strong>
              <span>軽い入力違いの可能性があります。確認後に採点します。</span>
              <div><button onClick={() => setPendingTextConfirmation(false)}>入力を直す</button><button onClick={() => void recordTextAnswer(true)}>はい、採点する</button></div>
            </div>}
          </div>
        )}
        {hasAnswered && (
          <div className={`answer-result ${isCorrect ? 'success' : 'error'}`} aria-live="polite">
            <strong>{isCorrect ? '正解です！' : '今回は違います'}</strong>
            <span>正解は「{getStation(demoNetwork, question.answerId)?.canonicalName}」です。</span>
            <button className="primary-button" onClick={next}>{index === questionIds.length - 1 ? '結果を見る' : '次の問題へ'}</button>
          </div>
        )}
        {!hasAnswered && <p className="subtle-note"><RotateCcw size={15} aria-hidden="true" />途中で閉じても、この問題から再開できます。</p>}
      </article>
    </section>
  )
}
