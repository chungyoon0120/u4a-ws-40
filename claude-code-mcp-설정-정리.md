# Claude Code MCP 설정 정리 (로컬 / 글로벌)

Claude Code의 MCP 설정은 세 가지 스코프(scope)로 관리됩니다.
흔히 말하는 "로컬 설정"은 `local`, "글로벌 설정"은 `user` 스코프에 해당합니다.

---

## 1. 세 가지 스코프 개요

| 스코프 | 적용 범위 | 저장 위치 | 주 용도 |
|--------|-----------|-----------|---------|
| `local` (기본값) | 현재 프로젝트 + 본인만 | `~/.claude.json` (프로젝트 경로를 키로 구분) | 테스트, 실험 |
| `project` | 프로젝트 + 팀 전체 | 프로젝트 루트의 `.mcp.json` | 팀 공유 도구 |
| `user` (글로벌) | 모든 프로젝트 + 본인 | `~/.claude.json` (전역) | 개인용 공통 도구 |

> 참고: 예전 버전에서는 `local`을 `project`, `user`를 `global`로 불렀습니다.

---

## 2. 로컬 설정 (local — 기본값)

- 현재 프로젝트에서 **본인에게만** 적용됩니다.
- `~/.claude.json`에 저장되며, **프로젝트 경로를 키로** 구분됩니다.
- 새 서버를 팀에 권하기 전에 테스트하거나 실험할 때 적합합니다.

```bash
# 스코프 플래그 없이 추가하면 local
claude mcp add <name> <command>
```

---

## 3. 글로벌 설정 (user)

- 본인의 **모든 프로젝트**에서 사용 가능합니다.
- `~/.claude.json`(홈 디렉터리)에 **전역으로** 저장됩니다.
- 에러 모니터링 등 여러 프로젝트에 두루 쓰는 개인 도구에 적합합니다.
- `local`과 `user` 모두 각 머신의 `~/.claude.json`에 저장되며 **머신 간 동기화는 되지 않습니다.**

```bash
claude mcp add <name> -s user <command>
```

---

## 4. 프로젝트 설정 (project) — 참고

- `--scope project`로 추가하면 프로젝트 루트의 `.mcp.json`에 기록됩니다.
- 이 파일을 **버전 관리에 커밋**하면 팀원 모두가 동일한 MCP 서버를 갖게 됩니다.

```bash
claude mcp add <name> -s project <command>
```

---

## 5. 우선순위 (Precedence)

같은 이름의 서버가 여러 스코프에 존재할 경우 다음 순서로 덮어씁니다.

```
local  >  project  >  user
```

- 팀은 `.mcp.json`(project)에 **기본값**을 정의하고,
- 개별 개발자는 자신의 자격 증명용 **local 설정**으로 덮어쓸 수 있습니다.

---

## 6. 자주 쓰는 명령어

```bash
claude mcp add <name> <command>          # 서버 추가 (기본 local)
claude mcp add <name> -s user <command>  # 글로벌(user) 추가
claude mcp add <name> -s project <command>  # 팀 공유(project) 추가
claude mcp list                          # 서버 목록 확인
claude mcp get <name>                     # 특정 서버 상태 확인
claude mcp remove <name>                  # 서버 제거
```

세션 내부에서는 `/mcp` 슬래시 명령으로 서버 상태 확인 및 OAuth 인증을 처리할 수 있습니다.

---

## 참고 문서

- 공식 문서: <https://code.claude.com/docs/en/mcp>
