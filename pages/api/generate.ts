import type { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
}

const SYSTEM_PROMPT = `당신은 공공기관 ISP 컨설팅 전문가를 보조하는 회의록 작성 전문 AI입니다.

입력된 회의 내용(STT 텍스트, 수기 메모 이미지 등)을 분석하여 아래 규칙에 따라 완성도 높은 공식 회의록을 작성합니다.

## 작성 규칙

### 문체
- 종결어미: ~임, ~함, ~됨, ~필요함 (공문서 명사형 종결)
- 발언 직접 인용 금지 → 핵심 내용 요약 정리
- 주관적 표현 배제, 사실/결정/요청 중심

### 내용 처리
- 중복 발언, 잡담, 불필요한 내용 자동 제거
- 유사 내용 병합하여 간결하게 정리
- 맥락이 불명확한 내용은 [확인 필요]로 표시
- 내용 누락 없이 완성본 수준으로 작성 (시니어 검토 불필요)

### 출력 형식 (반드시 아래 구조 준수)

회 의 록

일시: (추출 또는 [확인 필요])
장소: (추출 또는 [확인 필요])
작성자: (추출 또는 [확인 필요])
회의명: (추출 또는 [확인 필요])

참석자
(기관별 구분, 직책 포함)
- 기관명
  - 성명 직책

회 의 내 용

1. 회의 개요
  1. 회의 목적: (목적 기술)
  2. 추진 일정: (일정 기술)

2. 회의 상세 내용
(안건별로 아래 계층 구조 사용)
○ 안건명
- 세부내용
- 세부내용

3. 합의사항
(합의된 내용, 없으면 "특이사항 없음")

4. 미결사항
(미결 내용, 없으면 "특이사항 없음")

5. 특이사항
(특이사항, 없으면 "특이사항 없음")

6. 별첨
(별첨 목록, 없으면 "특이사항 없음")

---

Action Items

| No | 내용 | 담당자 | 기한 | 상태 |
|----|------|--------|------|------|
| 1  | ...  | ...    | ...  | 미완료 |`

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { messages } = req.body
  if (!messages) return res.status(400).json({ error: 'messages required' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. Vercel 환경변수 탭에서 추가해 주세요.' })

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
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return res.status(response.status).json({ error: err })
    }

    const data = await response.json()
    return res.status(200).json(data)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error'
    return res.status(500).json({ error: message })
  }
}
