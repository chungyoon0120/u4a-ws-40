# ServerList_v2

Electron 환경은 유지하고 SAPUI5만 제거한 HTML/CSS/JS 기반 ServerList 화면 전환본입니다.

## 반영된 실제 로직

- Electron/Node 초기화
- `if-globalSetting-info` IPC 수신
- `APPPATH`, `PATHINFO`, `SETTINGS`, `WSUTIL` 로딩
- SAP Logon Registry 조회
- SAP Landscape XML 읽기/파싱
- Workspace Tree 생성
- 서버 목록 생성
- 저장 서버 JSON(`SERVERINFO_V2`) 읽기/쓰기
- Active/Inactive 동기화
- 서버 등록/수정/삭제
- 서버 더블클릭 시 BrowserWindow 로그인 실행
- SAP Landscape XML 변경 감지
- 기존 `modules/Server/net` 유지

## 아직 UI만 연결한 영역

- Language 설정
- Theme 설정
- Sound 설정 상세
- About 상세 화면
- OPEN_SERVER 세부 검증

위 영역은 다음 단계에서 기존 함수 기준으로 추가 연결하면 됩니다.
