# ServerList_v2 함수 단위 분리 설계 (추가 반영본)

## 추가 설계 원칙

### Electron 환경 유지

본 프로젝트는 순수 브라우저 전환이 목적이 아니다.

유지 대상:

- Electron
- Node.js
- IPC
- Registry 접근
- SAPGUI 버전 체크
- Named Pipe
- 기존 APPPATH 구조
- 기존 함수명
- 기존 데이터 구조

제거 대상:

- SAPUI5 Framework
- JSONModel
- sap.m
- sap.ui.table
- sap.ui.layout

---

## 리소스 처리 기준 (중요)

기존 Electron 프로젝트의 APPPATH(www) 기준 리소스 구조를 그대로 유지한다.

예시:

```js
PATH.join(APPPATH, "sound", "sap", "sapmsg.wav");
PATH.join(APPPATH, "sound", "sap", "saperror.wav");
PATH.join(APPPATH, "img", "logo.png");
```

신규 assets 구조를 강제로 만들지 않는다.

잘못된 예:

```text
assets/
resources/
audio/message.wav
```

올바른 방향:

기존 ServerList.js 에서 사용 중인 경로를 최대한 유지하고,
UI5 의존 부분만 제거한다.

---

## 가독성 중심 분리 전략

이번 프로젝트는 React/Vue 스타일 구조가 아니라
기능 단위 분리를 목표로 한다.

```text
ServerList_v2
│
├─ ServerList.html
├─ ServerList.js
│
├─ js
│   ├─ bootstrap
│   ├─ common
│   ├─ saplogon
│   ├─ server
│   ├─ ui
│   ├─ dialog
│   └─ pipe
│
├─ css
└─ modules
```

### 분리 기준

"무슨 기능을 수정하는가?"

만 보고 바로 파일을 찾을 수 있어야 한다.

예)

- 서버 저장 수정
  - js/server/serverSave.js

- SAP Logon 수정
  - js/saplogon/saplogon.js

- Workspace Tree 수정
  - js/saplogon/workspace.js

- 설정 팝업 수정
  - js/dialog/

---

## 최종 목표

ServerList.js

5000+ 라인

→

200라인 이하

나머지는 기능 단위로 분리

- saplogon
- server
- ui
- dialog
- pipe

기존 함수명과 기존 로직은 최대한 유지한다.
