export interface DAORecord {
  id: string; // governor address lowercase
  governor: string;
  token: {
    id: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply?: string;
  } | string;
  timelock: string;
  creator: string;
  name: string;
  faucet?: {
    id: string;
    mode: number; // 0 = MINT, 1 = PRE_FUNDED
    claimAmount: string;
    cooldownPeriod: string;
    paused: boolean;
  } | string;
  proposalCount?: number;
  totalVotes?: string;
  voterCount?: number;
  holderCount?: number;
  createdAt?: string;
}

export type ProposalStateName = 
  | 'Pending'
  | 'Active'
  | 'Canceled'
  | 'Defeated'
  | 'Succeeded'
  | 'Queued'
  | 'Expired'
  | 'Executed';

export interface ProposalRecord {
  id: string;
  proposalId: string;
  governor: string;
  proposer: string;
  targets: string[];
  values: string[];
  signatures: string[];
  calldatas: string[];
  voteStart: string;
  voteEnd: string;
  description: string;
  state: ProposalStateName;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  quorum: string;
  eta?: string;
  executed: boolean;
  canceled: boolean;
  createdAt: string;
}

export interface VoteRecord {
  id: string;
  voter: string;
  support: number; // 0 = Against, 1 = For, 2 = Abstain
  weight: string;
  reason?: string;
  timestamp: string;
}
