# 회의록 자동 생성기

ISP 컨설팅 전용 AI 회의록 자동 생성 웹앱입니다.
STT 텍스트 파일과 수기 메모 이미지를 업로드하면 공문서 형식의 완성된 회의록을 즉시 생성합니다.

---

## 지원 입력 형식
- `.txt` — STT 변환 텍스트 (대용량 1시간+ 지원)
- `.jpg`, `.png`, `.webp` — 수기 메모 사진
- 두 가지 동시 업로드 → 하나의 회의록으로 합산 처리

## 출력 형식
- 공문서 명사형 종결어미 (~임, ~함, ~됨)
- 안건별 논의 내용 (계층 구조: ○, -)
- Action Items 별도 표 (담당자/기한 포함)
- 합의사항 / 미결사항 / 특이사항 / 별첨

---

## Vercel 배포 방법

### 1단계: GitHub에 올리기
```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/YOUR_ID/meeting-minutes.git
git push -u origin main
```

### 2단계: Vercel 연결
1. https://vercel.com 접속 → New Project
2. GitHub 저장소 선택
3. **Settings > Environment Variables** 에서 추가:
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-...` (Anthropic Console에서 발급)
4. Deploy 클릭

### 3단계: 완료
배포된 URL (예: `https://meeting-minutes-xxx.vercel.app`)로 접속하면 끝.
팀원과 URL 공유하면 누구나 사용 가능합니다.

---

## 로컬 실행 (개발용)
```bash
npm install
cp .env.example .env.local
# .env.local 에 실제 API 키 입력 후:
npm run dev
# → http://localhost:3000
```

---

## API 키 발급
https://console.anthropic.com → API Keys → Create Key
