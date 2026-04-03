import { useState, useRef, useCallback } from 'react'
import Head from 'next/head'

const ACCEPTED_TYPES = {
  'text/plain': 'txt',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/jpg': 'image',
  'image/webp': 'image',
}

function fileIcon(type) {
  if (type === 'image') return '🖼️'
  return '📄'
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1048576) return Math.round(bytes / 1024) + 'KB'
  return (bytes / 1048576).toFixed(1) + 'MB'
}

export default function Home() {
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const inputRef = useRef(null)

  const addFiles = useCallback((newFiles) => {
    const arr = Array.from(newFiles)
    const valid = arr.filter((f) => {
      const t = ACCEPTED_TYPES[f.type]
      return !!t
    })
    if (valid.length < arr.length) {
      setError('지원하지 않는 파일 형식이 포함되어 있습니다. TXT, JPG, PNG, WEBP만 허용됩니다.')
      setTimeout(() => setError(''), 4000)
    }
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size))
      const filtered = valid.filter((f) => !existing.has(f.name + f.size))
      return [...prev, ...filtered]
    })
  }, [])

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx))

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const readFile = (file) =>
    new Promise((resolve, reject) => {
      const type = ACCEPTED_TYPES[file.type]
      const reader = new FileReader()
      if (type === 'image') {
        reader.onload = (e) =>
          resolve({
            type: 'image',
            name: file.name,
            data: e.target.result.split(',')[1],
            mediaType: file.type,
          })
        reader.readAsDataURL(file)
      } else {
        reader.onload = (e) =>
          resolve({ type: 'text', name: file.name, data: e.target.result })
        reader.readAsText(file, 'utf-8')
      }
      reader.onerror = reject
    })

  const generate = async () => {
    if (files.length === 0) return
    setLoading(true)
    setResult('')
    setError('')

    try {
      const fileContents = await Promise.all(files.map(readFile))
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileContents }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '오류가 발생했습니다.')
      setResult(data.minutes)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadTxt = () => {
    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    a.download = `회의록_${today}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearAll = () => {
    setFiles([])
    setResult('')
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <Head>
        <title>회의록 자동 생성기</title>
        <meta name="description" content="STT 텍스트와 수기 메모로 공식 회의록 자동 생성" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-ink-50">
        {/* 헤더 */}
        <header className="border-b border-ink-200 bg-white">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-accent rounded flex items-center justify-center">
                <span className="text-white text-xs font-mono font-bold">M</span>
              </div>
              <div>
                <h1 className="text-sm font-semibold text-ink-900 tracking-tight">회의록 자동 생성기</h1>
                <p className="text-xs text-ink-400">ISP 컨설팅 전용 · AI 기반 공문서 작성</p>
              </div>
            </div>
            <span className="text-xs text-ink-300 font-mono">v1.0</span>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* 좌측: 업로드 */}
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-ink-900 mb-1">파일 업로드</h2>
                <p className="text-xs text-ink-400">STT 텍스트(.txt)와 수기 메모 사진(.jpg .png)을<br/>동시에 올리면 합쳐서 회의록을 생성합니다</p>
              </div>

              {/* 드롭존 */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                  dragging
                    ? 'border-accent bg-accent-muted'
                    : 'border-ink-200 bg-white hover:border-ink-400 hover:bg-ink-50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".txt,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
                <div className="text-3xl mb-3">📂</div>
                <p className="text-sm font-medium text-ink-700">
                  {dragging ? '여기에 놓으세요' : '클릭 또는 드래그로 업로드'}
                </p>
                <p className="text-xs text-ink-400 mt-1">TXT · JPG · PNG · WEBP</p>
                <div className="flex gap-2 justify-center mt-4">
                  {['STT 텍스트', '수기 메모 이미지', '대용량 OK'].map((label) => (
                    <span key={label} className="text-xs px-2 py-0.5 rounded-full bg-ink-100 text-ink-500">
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* 파일 목록 */}
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-lg border border-ink-100"
                    >
                      <span className="text-base">{fileIcon(ACCEPTED_TYPES[f.type])}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-ink-800 truncate">{f.name}</p>
                        <p className="text-xs text-ink-400">{formatBytes(f.size)}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent-muted text-accent text-[10px]">
                        {ACCEPTED_TYPES[f.type] === 'image' ? '이미지' : '텍스트'}
                      </span>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-ink-300 hover:text-ink-700 text-lg leading-none transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 에러 */}
              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
                  {error}
                </div>
              )}

              {/* 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={generate}
                  disabled={files.length === 0 || loading}
                  className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold transition-all hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-1">
                      <span>AI 분석 중</span>
                      <span className="flex gap-0.5">
                        <span className="dot w-1 h-1 bg-white rounded-full inline-block" />
                        <span className="dot w-1 h-1 bg-white rounded-full inline-block" />
                        <span className="dot w-1 h-1 bg-white rounded-full inline-block" />
                      </span>
                    </span>
                  ) : (
                    '회의록 생성'
                  )}
                </button>
                {(files.length > 0 || result) && (
                  <button
                    onClick={clearAll}
                    className="px-4 py-2.5 rounded-lg border border-ink-200 text-ink-500 text-sm hover:bg-ink-100 transition-colors"
                  >
                    초기화
                  </button>
                )}
              </div>
            </div>

            {/* 우측: 결과 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-ink-900">생성된 회의록</h2>
                  <p className="text-xs text-ink-400">검토 없이 바로 사용 가능한 완성본</p>
                </div>
                {result && (
                  <div className="flex gap-2">
                    <button
                      onClick={copyToClipboard}
                      className="text-xs px-3 py-1.5 rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-100 transition-colors"
                    >
                      {copied ? '✓ 복사됨' : '복사'}
                    </button>
                    <button
                      onClick={downloadTxt}
                      className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light transition-colors"
                    >
                      TXT 저장
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-ink-100 min-h-[520px] overflow-hidden">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[520px] gap-4 text-ink-400">
                    <div className="w-8 h-8 border-2 border-ink-200 border-t-accent rounded-full animate-spin" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-ink-600">회의록을 작성하는 중입니다</p>
                      <p className="text-xs mt-1">대용량 파일은 1~2분 소요될 수 있습니다</p>
                    </div>
                  </div>
                ) : result ? (
                  <div className="fade-up p-6">
                    <pre className="minutes-output text-xs text-ink-800 leading-relaxed">{result}</pre>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[520px] gap-3 text-ink-300">
                    <span className="text-4xl">📋</span>
                    <p className="text-sm">파일을 업로드하고 생성 버튼을 누르세요</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        <footer className="border-t border-ink-200 mt-16 py-6">
          <p className="text-center text-xs text-ink-300">
            회의록 자동 생성기 · Powered by Claude AI · ISP 컨설팅 전용
          </p>
        </footer>
      </div>
    </>
  )
}
