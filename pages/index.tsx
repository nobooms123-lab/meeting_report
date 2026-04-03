import { useState, useRef, useCallback } from 'react'
import Head from 'next/head'
import styles from '../styles/Home.module.css'

interface UploadedFile {
  name: string
  size: number
  type: string
  content: string        // text content or base64
  isImage: boolean
}

type Step = 'upload' | 'generating' | 'result'

export default function Home() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [step, setStep] = useState<Step>('upload')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const readFile = (file: File): Promise<UploadedFile> => {
    return new Promise((resolve, reject) => {
      const isImage = file.type.startsWith('image/')
      const reader = new FileReader()
      if (isImage) {
        reader.onload = (e) => {
          const base64 = (e.target?.result as string).split(',')[1]
          resolve({ name: file.name, size: file.size, type: file.type, content: base64, isImage: true })
        }
        reader.readAsDataURL(file)
      } else {
        reader.onload = (e) => {
          resolve({ name: file.name, size: file.size, type: file.type, content: e.target?.result as string, isImage: false })
        }
        reader.readAsText(file, 'utf-8')
      }
      reader.onerror = reject
    })
  }

  const handleFiles = useCallback(async (incoming: FileList | null) => {
    if (!incoming) return
    const allowed = ['text/plain', 'image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'text/markdown']
    const newFiles: UploadedFile[] = []
    for (const file of Array.from(incoming)) {
      const ok = allowed.some(t => file.type === t) || file.name.endsWith('.txt') || file.name.endsWith('.md')
      if (!ok) continue
      if (files.find(f => f.name === file.name && f.size === file.size)) continue
      try {
        const parsed = await readFile(file)
        newFiles.push(parsed)
      } catch { /* skip */ }
    }
    setFiles(prev => [...prev, ...newFiles])
  }, [files])

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i))

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const generate = async () => {
    if (!files.length) return
    setStep('generating')
    setError('')
    setProgress(10)

    const content: object[] = []
    for (const f of files) {
      if (f.isImage) {
        content.push({ type: 'text', text: `[파일명: ${f.name}] 수기 메모 이미지:` })
        content.push({ type: 'image', source: { type: 'base64', media_type: f.type, data: f.content } })
      } else {
        content.push({ type: 'text', text: `[파일명: ${f.name}]\n${f.content}` })
      }
    }
    content.push({ type: 'text', text: '\n위 파일의 내용을 바탕으로 공식 회의록을 작성해 주세요.' })

    setProgress(30)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content }] }),
      })
      setProgress(80)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'API 오류')
      const text = data.content?.[0]?.text || ''
      setResult(text)
      setStep('result')
      setProgress(100)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '알 수 없는 오류'
      setError(message)
      setStep('upload')
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result)
  }

  const downloadDocx = async () => {
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType, BorderStyle } = await import('docx')
    const { saveAs } = await import('file-saver')

    const lines = result.split('\n')
    const docChildren: object[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        docChildren.push(new Paragraph({ text: '' }))
        continue
      }
      if (trimmed.startsWith('# ')) {
        docChildren.push(new Paragraph({
          text: trimmed.replace(/^# /, ''),
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }))
      } else if (trimmed.startsWith('## ')) {
        docChildren.push(new Paragraph({ text: trimmed.replace(/^## /, ''), heading: HeadingLevel.HEADING_2 }))
      } else if (trimmed.startsWith('### ')) {
        docChildren.push(new Paragraph({ text: trimmed.replace(/^### /, ''), heading: HeadingLevel.HEADING_3 }))
      } else if (trimmed.startsWith('#### ')) {
        docChildren.push(new Paragraph({ text: trimmed.replace(/^#### /, ''), heading: HeadingLevel.HEADING_4 }))
      } else if (trimmed.startsWith('| ')) {
        // 표는 스킵 (별도 처리)
        continue
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        docChildren.push(new Paragraph({
          text: trimmed.replace(/^[-*] /, ''),
          bullet: { level: 0 },
        }))
      } else if (trimmed.startsWith('---')) {
        continue
      } else {
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: trimmed, size: 22 })],
        }))
      }
    }

    // Action Items 표 파싱
    const tableLines = lines.filter(l => l.trim().startsWith('|'))
    if (tableLines.length > 2) {
      const rows = tableLines
        .filter(l => !l.includes('----'))
        .map(l => l.split('|').filter(c => c.trim()).map(c => c.trim()))
      
      const tableRows = rows.map((row, i) =>
        new TableRow({
          children: row.map(cell =>
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: cell, bold: i === 0, size: 20 })],
              })],
              width: { size: Math.floor(9000 / row.length), type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1 },
                bottom: { style: BorderStyle.SINGLE, size: 1 },
                left: { style: BorderStyle.SINGLE, size: 1 },
                right: { style: BorderStyle.SINGLE, size: 1 },
              },
            })
          ),
        })
      )
      docChildren.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = new Document({ sections: [{ children: docChildren as any[] }] })
    const blob = await Packer.toBlob(doc)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    saveAs(blob, `회의록_${today}.docx`)
  }

  const reset = () => {
    setFiles([])
    setResult('')
    setError('')
    setStep('upload')
    setProgress(0)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + 'B'
    if (bytes < 1048576) return Math.round(bytes / 1024) + 'KB'
    return (bytes / 1048576).toFixed(1) + 'MB'
  }

  const getIcon = (f: UploadedFile) => {
    if (f.isImage) return '🖼️'
    if (f.name.endsWith('.pdf')) return '📄'
    return '📃'
  }

  return (
    <>
      <Head>
        <title>회의록 자동 생성</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700&family=Noto+Sans+KR:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className={styles.root}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <div className={styles.logo}>
              <span className={styles.logoMark}>⊡</span>
              <span className={styles.logoText}>회의록 자동생성</span>
            </div>
            <div className={styles.headerSub}>ISP 컨설팅 전용 · AI 기반</div>
          </div>
        </header>

        <main className={styles.main}>
          {step === 'upload' && (
            <div className={styles.uploadView}>
              <div className={styles.uploadHero}>
                <h1 className={styles.heroTitle}>파일 업로드만 하면<br />회의록이 완성됩니다</h1>
                <p className={styles.heroSub}>STT 텍스트 · 수기 메모 이미지 · 복수 파일 동시 업로드 지원</p>
              </div>

              <div
                className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.md,.jpg,.jpeg,.png,.pdf"
                  onChange={e => handleFiles(e.target.files)}
                  style={{ display: 'none' }}
                />
                <div className={styles.dropIcon}>
                  {isDragging ? '📂' : '⬆'}
                </div>
                <p className={styles.dropTitle}>드래그하거나 클릭해서 파일 선택</p>
                <div className={styles.dropPills}>
                  {['TXT', 'MD', 'JPG / PNG', 'PDF'].map(t => (
                    <span key={t} className={styles.pill}>{t}</span>
                  ))}
                </div>
              </div>

              {files.length > 0 && (
                <div className={styles.fileList}>
                  {files.map((f, i) => (
                    <div key={i} className={styles.fileItem}>
                      <span className={styles.fileIcon}>{getIcon(f)}</span>
                      <div className={styles.fileInfo}>
                        <span className={styles.fileName}>{f.name}</span>
                        <span className={styles.fileSize}>{formatSize(f.size)}</span>
                      </div>
                      <span className={styles.fileReady}>대기중</span>
                      <button className={styles.fileRemove} onClick={() => removeFile(i)}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {error && <div className={styles.errorBox}>⚠ {error}</div>}

              {files.length > 0 && (
                <div className={styles.generateRow}>
                  <button className={styles.btnPrimary} onClick={generate}>
                    회의록 생성 →
                  </button>
                  <button className={styles.btnGhost} onClick={reset}>초기화</button>
                </div>
              )}
            </div>
          )}

          {step === 'generating' && (
            <div className={styles.generatingView}>
              <div className={styles.genSpinner}>
                <div className={styles.spinnerRing} />
              </div>
              <h2 className={styles.genTitle}>AI가 회의록을 작성하는 중입니다</h2>
              <p className={styles.genSub}>중복 제거 · 내용 병합 · 공문서 형식 변환 중...</p>
              <div className={styles.progressWrap}>
                <div className={styles.progressBar} style={{ width: `${progress}%` }} />
              </div>
              <p className={styles.progressLabel}>{progress}%</p>
            </div>
          )}

          {step === 'result' && (
            <div className={styles.resultView}>
              <div className={styles.resultToolbar}>
                <span className={styles.resultDone}>✓ 회의록 생성 완료</span>
                <div className={styles.resultActions}>
                  <button className={styles.btnGhost} onClick={copyToClipboard}>복사</button>
                  <button className={styles.btnGhost} onClick={downloadDocx}>Word 다운로드</button>
                  <button className={styles.btnPrimary} onClick={reset}>새 회의록</button>
                </div>
              </div>
              <div className={styles.resultBox}>
                <pre className={styles.resultText}>{result}</pre>
              </div>
            </div>
          )}
        </main>

        <footer className={styles.footer}>
          <span>Powered by Claude · ISP 컨설팅 전용</span>
        </footer>
      </div>
    </>
  )
}
