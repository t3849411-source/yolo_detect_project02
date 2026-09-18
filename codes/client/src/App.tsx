import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Crosshair,
  FileImage,
  Gauge,
  LoaderCircle,
  RotateCcw,
  ScanSearch,
  Server,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react'
import { API_BASE_URL, detectDrone, fetchHealth } from './api'
import type { DetectionResponse, HealthResponse } from './types'

type ViewState = 'empty' | 'ready' | 'loading' | 'success' | 'error'
type ServerState = 'checking' | 'ready' | 'retrying'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp']
const MAX_FILE_BYTES = 10 * 1024 * 1024

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [state, setState] = useState<ViewState>('empty')
  const [result, setResult] = useState<DetectionResponse | null>(null)
  const [error, setError] = useState('')
  const [confidence, setConfidence] = useState(0.25)
  const [iou, setIou] = useState(0.7)
  const [dragging, setDragging] = useState(false)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [serverState, setServerState] = useState<ServerState>('checking')
  const fileInput = useRef<HTMLInputElement>(null)
  const requestController = useRef<AbortController | null>(null)

  useEffect(() => {
    let stopped = false
    let retryTimer: number | undefined
    let controller: AbortController | undefined

    const checkServer = async () => {
      controller = new AbortController()
      try {
        const response = await fetchHealth(controller.signal)
        if (!stopped) {
          setHealth(response)
          setServerState('ready')
        }
      } catch {
        if (!stopped) {
          setHealth(null)
          setServerState('retrying')
          retryTimer = window.setTimeout(checkServer, 5_000)
        }
      }
    }

    void checkServer()
    return () => {
      stopped = true
      controller?.abort()
      if (retryTimer) window.clearTimeout(retryTimer)
    }
  }, [])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const chooseFile = (selected?: File) => {
    if (!selected) return
    setError('')
    setResult(null)
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setState('error')
      setError('JPEG, PNG, WebP, BMP 이미지만 올릴 수 있습니다.')
      return
    }
    if (selected.size > MAX_FILE_BYTES) {
      setState('error')
      setError('파일 크기는 10MB 이하여야 합니다.')
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setState('ready')
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    chooseFile(event.dataTransfer.files[0])
  }

  const reset = () => {
    requestController.current?.abort()
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl('')
    setResult(null)
    setError('')
    setState('empty')
    if (fileInput.current) fileInput.current.value = ''
  }

  const analyze = async () => {
    if (!file) return
    const controller = new AbortController()
    requestController.current = controller
    setState('loading')
    setError('')
    try {
      const response = await detectDrone(file, confidence, iou, controller.signal)
      setResult(response)
      setState('success')
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setState('error')
      setError(reason instanceof Error ? reason.message : '분석 중 알 수 없는 오류가 발생했습니다.')
    }
  }

  const fileChange = (event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0])
  const hasDetections = Boolean(result?.detection_count)

  return (
    <div className="min-h-screen overflow-hidden bg-[#07111e] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,0.11),transparent_30%),radial-gradient(circle_at_85%_25%,rgba(59,130,246,0.10),transparent_25%)]" />
      <header className="relative border-b border-white/8 bg-[#07111e]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
              <Crosshair size={21} strokeWidth={1.8} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-[0.18em] text-white">SKYTRACE</span>
                <span className="rounded bg-cyan-300/10 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-cyan-300">YOLO</span>
              </div>
              <p className="mt-0.5 text-[11px] tracking-wide text-slate-500">드론 객체 탐지 시스템</p>
            </div>
          </div>
          <div className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[11px] sm:px-3 sm:text-xs ${health ? 'border-emerald-400/20 bg-emerald-400/8 text-emerald-300' : 'border-amber-300/20 bg-amber-300/8 text-amber-200'}`}>
            <span className={`size-1.5 rounded-full ${health ? 'bg-emerald-300 shadow-[0_0_8px_#6ee7b7]' : 'animate-pulse bg-amber-300'}`} />
            {serverState === 'ready' ? '탐지 서버 연결됨' : serverState === 'retrying' ? '무료 서버 시작 대기 중' : '서버 연결 확인 중'}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        <section className="mb-9 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/5 px-3 py-1 text-xs font-medium text-cyan-200">
            <ScanSearch size={13} /> AI 이미지 분석
          </div>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-[44px]">
            사진 속 드론을 <span className="text-cyan-300">빠르게 탐지</span>하세요
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            이미지를 올리면 학습된 YOLO 모델이 드론의 위치와 신뢰도를 분석합니다.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1726]/80 shadow-2xl shadow-black/15">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2.5">
                <FileImage size={18} className="text-cyan-300" />
                <h2 className="font-semibold text-slate-100">분석 이미지</h2>
              </div>
              {file && (
                <button onClick={reset} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white">
                  <RotateCcw size={13} /> 다시 선택
                </button>
              )}
            </div>

            {!previewUrl ? (
              <div className="p-5 sm:p-6">
                <div
                  onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileInput.current?.click()}
                  className={`group grid min-h-[390px] cursor-pointer place-items-center rounded-xl border border-dashed transition sm:min-h-[470px] ${dragging ? 'border-cyan-300 bg-cyan-300/8' : 'border-slate-600/70 bg-[#081320] hover:border-cyan-300/60 hover:bg-cyan-300/[0.03]'}`}
                >
                  <div className="max-w-sm px-6 text-center">
                    <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/8 text-cyan-300 transition group-hover:scale-105 group-hover:bg-cyan-300/12">
                      <UploadCloud size={30} strokeWidth={1.6} />
                    </div>
                    <p className="mt-5 text-base font-medium text-white">이미지를 여기에 끌어다 놓으세요</p>
                    <p className="mt-2 text-sm text-slate-500">또는 클릭해서 파일을 선택하세요</p>
                    <span className="mt-5 inline-flex rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300">파일 찾아보기</span>
                    <p className="mt-5 text-[11px] text-slate-600">JPEG · PNG · WebP · BMP / 최대 10MB</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-6">
                <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-xl border border-white/8 bg-[#050b12] sm:min-h-[470px]">
                  <div className="relative inline-block max-h-[620px] max-w-full leading-[0]">
                    <img src={previewUrl} alt="분석할 이미지" className="block max-h-[620px] max-w-full object-contain" />
                    {result?.detections.map((detection, index) => {
                      const box = detection.bbox_normalized
                      return (
                        <div
                          key={`${index}-${detection.confidence}`}
                          className="absolute border-2 border-cyan-300 shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_0_16px_rgba(34,211,238,0.25)]"
                          style={{ left: `${box.x1 * 100}%`, top: `${box.y1 * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}
                        >
                          <span className="absolute -top-6 left-[-2px] whitespace-nowrap rounded-t bg-cyan-300 px-1.5 py-1.5 text-[10px] font-bold leading-none text-[#07111e]">
                            드론 {(detection.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  {state === 'loading' && (
                    <div className="absolute inset-0 grid place-items-center bg-[#07111e]/80 backdrop-blur-sm">
                      <div className="text-center">
                        <LoaderCircle className="mx-auto animate-spin text-cyan-300" size={38} />
                        <p className="mt-4 text-sm font-medium text-white">이미지를 분석하고 있습니다</p>
                        <p className="mt-1.5 text-xs text-slate-500">드론 후보 영역을 찾는 중입니다</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span className="min-w-0 truncate">{file?.name}</span>
                  <span className="shrink-0">{file && formatBytes(file.size)}</span>
                </div>
              </div>
            )}
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/bmp" onChange={fileChange} className="hidden" />
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-white/10 bg-[#0b1726]/80 p-5 sm:p-6">
              <div className="mb-6 flex items-center gap-2.5">
                <Gauge size={18} className="text-cyan-300" />
                <h2 className="font-semibold text-white">탐지 설정</h2>
              </div>
              <label className="block">
                <span className="flex items-center justify-between text-xs text-slate-400">
                  신뢰도 기준 <strong className="font-mono text-cyan-300">{confidence.toFixed(2)}</strong>
                </span>
                <input type="range" min="0.05" max="0.95" step="0.05" value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="mt-3 w-full accent-cyan-300" />
                <span className="mt-1.5 block text-[11px] leading-4 text-slate-600">값이 높을수록 확실한 탐지만 표시합니다.</span>
              </label>
              <div className="my-5 h-px bg-white/7" />
              <label className="block">
                <span className="flex items-center justify-between text-xs text-slate-400">
                  겹침 제거 기준 <strong className="font-mono text-cyan-300">{iou.toFixed(2)}</strong>
                </span>
                <input type="range" min="0.1" max="0.9" step="0.05" value={iou} onChange={(e) => setIou(Number(e.target.value))} className="mt-3 w-full accent-cyan-300" />
                <span className="mt-1.5 block text-[11px] leading-4 text-slate-600">겹치는 탐지 상자를 합치는 기준입니다.</span>
              </label>
              <button
                onClick={analyze}
                disabled={!file || state === 'loading' || !health}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-[#07111e] shadow-[0_10px_30px_rgba(34,211,238,0.14)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none"
              >
                {state === 'loading' ? <><LoaderCircle size={17} className="animate-spin" /> 분석 중</> : <><ScanSearch size={17} /> 드론 탐지 시작 <ChevronRight size={15} /></>}
              </button>
            </section>

            {state === 'error' && (
              <section className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-5">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 shrink-0 text-rose-300" size={18} />
                  <div>
                    <p className="text-sm font-semibold text-rose-200">분석할 수 없습니다</p>
                    <p className="mt-1.5 text-xs leading-5 text-rose-200/60">{error}</p>
                  </div>
                  <button onClick={() => setError('')} aria-label="오류 닫기" className="ml-auto self-start text-rose-300/50 hover:text-rose-200"><X size={15} /></button>
                </div>
              </section>
            )}

            {result ? (
              <section className="rounded-2xl border border-white/10 bg-[#0b1726]/80 p-5 sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">탐지 결과</p>
                    <div className="mt-1 flex items-end gap-2">
                      <strong className="text-4xl font-semibold tracking-tight text-white">{result.detection_count}</strong>
                      <span className="pb-1 text-sm text-slate-400">개의 드론</span>
                    </div>
                  </div>
                  <div className={`grid size-10 place-items-center rounded-xl ${hasDetections ? 'bg-cyan-300/10 text-cyan-300' : 'bg-slate-700/40 text-slate-400'}`}>
                    {hasDetections ? <Crosshair size={21} /> : <CheckCircle2 size={21} />}
                  </div>
                </div>
                {!hasDetections && <p className="mt-4 rounded-lg bg-white/[0.03] px-3 py-2.5 text-xs leading-5 text-slate-400">설정한 신뢰도 기준에서 드론이 발견되지 않았습니다.</p>}
                {hasDetections && (
                  <div className="mt-5 max-h-44 space-y-2 overflow-auto pr-1">
                    {result.detections.map((detection, index) => (
                      <div key={index} className="flex items-center justify-between rounded-lg border border-white/7 bg-white/[0.025] px-3 py-2.5">
                        <span className="flex items-center gap-2 text-xs text-slate-300"><span className="size-1.5 rounded-full bg-cyan-300" /> 드론 {index + 1}</span>
                        <strong className="font-mono text-xs text-cyan-300">{(detection.confidence * 100).toFixed(1)}%</strong>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/7 bg-[#081320] p-3">
                    <Clock3 size={14} className="text-slate-500" />
                    <p className="mt-2 text-[10px] text-slate-500">전체 처리 시간</p>
                    <strong className="mt-0.5 block font-mono text-sm text-white">{result.timing.total_ms.toFixed(1)} ms</strong>
                  </div>
                  <div className="rounded-xl border border-white/7 bg-[#081320] p-3">
                    <Activity size={14} className="text-slate-500" />
                    <p className="mt-2 text-[10px] text-slate-500">모델 추론 시간</p>
                    <strong className="mt-0.5 block font-mono text-sm text-white">{result.timing.inference_ms.toFixed(1)} ms</strong>
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-white/8 bg-[#0b1726]/50 p-5">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <ShieldCheck size={17} className="text-slate-600" /> 이미지가 서버에 저장되지 않고 요청 안에서 처리됩니다.
                </div>
              </section>
            )}
          </aside>
        </div>

        <footer className="mt-8 flex flex-col gap-2 border-t border-white/7 pt-5 text-[11px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>YOLO26n · 단일 클래스 드론 탐지</span>
          <span className="flex items-center gap-1.5"><Server size={12} /> {health?.model ?? API_BASE_URL} · {health?.device ?? '연결 대기'}</span>
        </footer>
      </main>
    </div>
  )
}

export default App
