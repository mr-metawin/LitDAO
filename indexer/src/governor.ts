import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ProposalCreated,
  VoteCast,
  VoteCastWithParams,
  ProposalQueued,
  ProposalExecuted,
  ProposalCanceled
} from "../generated/templates/GovernorTemplate/DAOGovernor";
import { DAO, Proposal, Vote } from "../generated/schema";

export function handleProposalCreated(event: ProposalCreated): void {
  let daoId = event.address.toHexString().toLowerCase();
  let dao = DAO.load(daoId);
  if (dao != null) {
    dao.proposalCount = dao.proposalCount.plus(BigInt.fromI32(1));
    dao.save();
  }

  let proposalIdStr = event.params.proposalId.toString();
  let entityId = daoId + "-" + proposalIdStr;

  let proposal = new Proposal(entityId);
  proposal.dao = daoId;
  proposal.proposalId = event.params.proposalId;
  proposal.proposer = event.params.proposer;

  let targets: Bytes[] = [];
  let eventTargets = event.params.targets;
  for (let i = 0; i < eventTargets.length; i++) {
    targets.push(eventTargets[i]);
  }
  proposal.targets = targets;
  proposal.values = event.params.values;
  proposal.calldatas = event.params.calldatas;
  proposal.description = event.params.description;
  proposal.startBlock = event.params.voteStart;
  proposal.endBlock = event.params.voteEnd;
  proposal.status = "Pending";
  proposal.forVotes = BigInt.zero();
  proposal.againstVotes = BigInt.zero();
  proposal.abstainVotes = BigInt.zero();
  proposal.createdAt = event.block.timestamp;
  proposal.createdBlock = event.block.number;
  proposal.save();
}

export function handleVoteCast(event: VoteCast): void {
  _processVote(
    event.address.toHexString().toLowerCase(),
    event.params.proposalId,
    event.params.voter,
    event.params.support,
    event.params.weight,
    event.params.reason,
    event.block.timestamp,
    event.block.number
  );
}

export function handleVoteCastWithParams(event: VoteCastWithParams): void {
  _processVote(
    event.address.toHexString().toLowerCase(),
    event.params.proposalId,
    event.params.voter,
    event.params.support,
    event.params.weight,
    event.params.reason,
    event.block.timestamp,
    event.block.number
  );
}

function _processVote(
  daoId: string,
  proposalId: BigInt,
  voter: Bytes,
  support: i32,
  weight: BigInt,
  reason: string,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let proposalEntityId = daoId + "-" + proposalId.toString();
  let proposal = Proposal.load(proposalEntityId);
  if (proposal == null) {
    return;
  }

  let voteEntityId = proposalEntityId + "-" + voter.toHexString().toLowerCase();
  let existingVote = Vote.load(voteEntityId);
  let isNewVoter = existingVote == null;

  let vote = new Vote(voteEntityId);
  vote.proposal = proposalEntityId;
  vote.voter = voter;
  vote.support = support;
  vote.weight = weight;
  vote.reason = reason;
  vote.timestamp = timestamp;
  vote.blockNumber = blockNumber;
  vote.save();

  // Update proposal tallies
  if (support == 0) {
    proposal.againstVotes = proposal.againstVotes.plus(weight);
  } else if (support == 1) {
    proposal.forVotes = proposal.forVotes.plus(weight);
  } else if (support == 2) {
    proposal.abstainVotes = proposal.abstainVotes.plus(weight);
  }
  proposal.save();

  // If this is the voter's first vote in this DAO, increment voterCount
  if (isNewVoter) {
    let dao = DAO.load(daoId);
    if (dao != null) {
      dao.voterCount = dao.voterCount.plus(BigInt.fromI32(1));
      dao.save();
    }
  }
}

export function handleProposalQueued(event: ProposalQueued): void {
  let daoId = event.address.toHexString().toLowerCase();
  let entityId = daoId + "-" + event.params.proposalId.toString();
  let proposal = Proposal.load(entityId);
  if (proposal != null) {
    proposal.status = "Queued";
    proposal.queuedAt = event.block.timestamp;
    proposal.save();
  }
}

export function handleProposalExecuted(event: ProposalExecuted): void {
  let daoId = event.address.toHexString().toLowerCase();
  let entityId = daoId + "-" + event.params.proposalId.toString();
  let proposal = Proposal.load(entityId);
  if (proposal != null) {
    proposal.status = "Executed";
    proposal.executedAt = event.block.timestamp;
    proposal.save();
  }
}

export function handleProposalCanceled(event: ProposalCanceled): void {
  let daoId = event.address.toHexString().toLowerCase();
  let entityId = daoId + "-" + event.params.proposalId.toString();
  let proposal = Proposal.load(entityId);
  if (proposal != null) {
    proposal.status = "Canceled";
    proposal.canceledAt = event.block.timestamp;
    proposal.save();
  }
}
