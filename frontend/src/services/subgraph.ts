import { SUBGRAPH_URL } from '../config/chain';

export async function querySubgraph<T>(query: string, variables: Record<string, any> = {}): Promise<T> {
  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Subgraph HTTP error ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || 'GraphQL query error');
  }
  return json.data;
}

export const GET_ALL_DAOS_QUERY = `
  query GetAllDAOs {
    daos(orderBy: createdAt, orderDirection: desc) {
      id
      governor
      token
      timelock
      registrant
      name
      imageUri
      description
      createdAt
      createdBlock
      proposalCount
      voterCount
      holderCount
    }
    tokens {
      id
      name
      symbol
    }
  }
`;

export const GET_DAO_BY_ID_QUERY = `
  query GetDAOById($id: ID!) {
    dao(id: $id) {
      id
      governor
      token
      timelock
      registrant
      name
      imageUri
      description
      createdAt
      createdBlock
      proposalCount
      voterCount
      holderCount

      proposals(orderBy: createdAt, orderDirection: desc) {
        id
        proposalId
        proposer
        targets
        values
        calldatas
        description
        startBlock
        endBlock
        status
        forVotes
        againstVotes
        abstainVotes
        createdAt
        queuedAt
        executedAt
        canceledAt
      }
    }
    tokens {
      id
      name
      symbol
    }
    faucets {
      id
      token
      mode
    }
  }
`;

export const GET_PROPOSAL_DETAILS_QUERY = `
  query GetProposalDetails($id: ID!) {
    proposal(id: $id) {
      id
      proposalId
      proposer
      targets
      values
      calldatas
      description
      startBlock
      endBlock
      status
      forVotes
      againstVotes
      abstainVotes
      createdAt
      queuedAt
      executedAt
      canceledAt
      dao {
        id
        name
        token
        governor
        timelock
      }
      votes(orderBy: timestamp, orderDirection: desc) {
        id
        voter
        support
        weight
        reason
        timestamp
      }
    }
  }
`;

export const GET_FAUCET_BY_TOKEN_QUERY = `
  query GetFaucetByToken($token: Bytes!) {
    faucets(where: { token: $token }) {
      id
      token
      admin
      mode
      claimCount
      totalClaimed
      createdAt
    }
  }
`;
