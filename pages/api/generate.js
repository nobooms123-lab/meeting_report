export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }

const SYSTEM_PROMPT = `당신은 공공기관 ISP 컨설팅 전문가를 보조하는 회의록 작성 AI입니다.
업로드된 STT 텍스트 및/또는 수기 메모 이미지를 분석하여 아래 규칙에 따라 완성된 공식 회의록을 작성합니다.

[작성 규칙]
1. 문체: 공문서 명사형 종결어미 사용 (~임, ~함, ~됨, ~필요함, ~요청함)
2. 발언 내용은 직접 인용 없이 핵심만 요약 정리
3. 중복 발언, 잡담, 불필요한 내용은 자동 제거
4. 유사한 내용은 하나로 병합하여 정리
5. 원본에서 파악 불가한 정보는 [확인 필요]로 표시

[출력 형식]

<회 의 록>

일  시: [일시]　　장  소: [장소]　　작 성 자: [작성자]
회 의 명: [회의명]
참 석 자:
[기관명]
  - [직책] [이름]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
회 의 내 용
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 회의 개요
  1) 회의 목적: [목적]
  2) 추진 일정: [일정]

2. 회의 상세 내용

○ [소제목]
  - [세부내용]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Action Items
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No | 내용 | 담당자 | 기한 | 비고
---|------|--------|------|----
1  | [내용] | [담당자] | [기한] | [비고]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
합 의 사 항: [내용 또는 특이사항 없음]
미 결 사 항: [내용 또는 특이사항 없음]
특 이 사 항: [내용 또는 특이사항 없음]
별      첨: [내용 또는 특이사항 없음]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

시니어 검토 없이 바로 사용할 수 있는 완성본으로 작성하십시오.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { files } = req.body
  if (!files || files.length === 0) return res.status(400).json({ error: '파일이 없습니다.' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.' })

  const content = []
  for (const file of files) {
    if (file.type === 'image') {
      content.push({ type: 'text', text: `[첨부파일: ${file.name}] 수기 메모 이미지` })
      content.push({ type: 'image', source: { type: 'base64', media_type: file.mediaType, data: file.data } })
    } else {
      content.push({ type: 'text', text: `[첨부파일: ${file.name}]\n\n${file.data}` })
    }
  }
  content.push({ type: 'text', text: '위 자료를 바탕으로 규칙에 따라 완성된 회의록을 작성하십시오.' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'API 오류')
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
    return res.status(200).json({ minutes: text })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
