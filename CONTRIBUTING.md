# Contributing to HealthFlow

## Local development

```bash
git clone https://github.com/PranavAchar01/HealthFlow
cd HealthFlow
cp .env.example .env.local   # fill in at minimum ANTHROPIC_API_KEY
npm install
npm run dev
```

Apps run on:
| App | URL |
|-----|-----|
| API + agent pipeline | http://localhost:3001 |
| Paramedic field UI | http://localhost:3002 |
| Doctor dashboard | http://localhost:3003 |
| Nurse dashboard | http://localhost:3004 |
| 911 Dispatch | http://localhost:3005 |

## Running tests

```bash
cd apps/api
npm test           # unit tests (no API key needed — uses mocks)
npm run test:watch # watch mode
```

## Adding a new agent

1. Create `apps/api/src/agents/chains/your-agent-chain.ts`
2. Export a `runYourAgentChain(encounter: Encounter): Promise<YourResult>` function
3. Include a `fallbackYourAgent()` function for when no LLM key is configured
4. Wire it into `apps/api/src/agents/agent-pipeline.ts` at the appropriate pipeline step
5. Add an `AuditEntry` via `createAuditEntry()` so the action appears in the audit trail
6. Write tests in `apps/api/src/agents/chains/__tests__/your-agent-chain.test.ts`

## Code style

- TypeScript strict mode — no `any` without justification
- No `console.log` in production paths (`console.error` in catch blocks is fine)
- Validate only at system boundaries (API routes), not inside agents
- Keep files under 500 lines

## Pull requests

- One feature or fix per PR
- Tests required for new agent chains
- `npm run build` must pass
- Brief description of what changed and why in the PR body
