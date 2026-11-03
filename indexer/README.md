# Agora Subgraph (Goldsky Indexer)

Production GraphQL indexer for the Agora governance platform on **liteforge LiteForge (Chain ID: 4441)**.

## Architecture

- **Static Data Sources**:
  - `DAORegistry` (`0xfF8c3453f5617C0483e3D2f38F70126772D6F247`)
  - `TokenFactory` (`0x9b3E75Df9bBBCD2b60645ecb473d838f3eAa5dea`)
  - `GovernorFactory` (`0xfE6e5f87AA0be25c73BeF342217F2b170C9e38a2`)
  - `FaucetFactory` (`0x01aD919d404Cd4a67F990499753fEBB78d21ED6b`)
- **Dynamic Templates**:
  - `GovernorTemplate`: Automatically spawned for every new DAO governor registered. Indexes `ProposalCreated`, `VoteCast`, `VoteCastWithParams`, `ProposalQueued`, `ProposalExecuted`, `ProposalCanceled`.
  - `TokenTemplate`: Automatically spawned for every governance token. Indexes `Transfer` (holder counts and balances) and `DelegateChanged` / `DelegateVotesChanged`.
  - `FaucetTemplate`: Automatically spawned for every DAO faucet. Indexes `Claimed` events.

## Build

```bash
# Generate AssemblyScript types from schema.graphql and ABIs
npm run codegen

# Compile mappings to WebAssembly
npm run build
```

## Goldsky Deployment Guide

### 1. Log in to Goldsky
Log in via your browser:
```bash
goldsky login
```
Or if working in a headless environment, create an API token at [Goldsky Dashboard Settings](https://app.goldsky.com/dashboard/settings) and log in:
```bash
goldsky login --token <YOUR_GOLDSKY_API_TOKEN>
```

### 2. Deploy the Subgraph
From this `indexer/` directory:
```bash
goldsky subgraph deploy litdao/1.0.0 --path .
```

### 3. Check Status & Logs
```bash
# View deployment status
goldsky subgraph list

# Tail live indexing logs
goldsky subgraph log litdao/1.0.0
```

### 4. GraphQL Endpoint
Once deployed, Goldsky provides your public GraphQL endpoint:
```
https://api.goldsky.com/api/public/project_<project_id>/subgraphs/litdao/1.0.0/gn
```
Copy this URL into `frontend/.env` under `VITE_GOLDSKY_GRAPHQL_URL`.
