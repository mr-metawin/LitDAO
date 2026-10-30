import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  Transfer,
  DelegateChanged,
  DelegateVotesChanged
} from "../generated/templates/TokenTemplate/DAOToken";
import { TokenHolder, Delegate } from "../generated/schema";

let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function handleTransfer(event: Transfer): void {
  let tokenAddr = event.address.toHexString().toLowerCase();
  let fromAddr = event.params.from.toHexString().toLowerCase();
  let toAddr = event.params.to.toHexString().toLowerCase();
  let value = event.params.value;

  // Process sender (unless mint)
  if (fromAddr != ZERO_ADDRESS) {
    let fromHolderId = tokenAddr + "-" + fromAddr;
    let fromHolder = TokenHolder.load(fromHolderId);
    if (fromHolder != null) {
      fromHolder.balance = fromHolder.balance.minus(value);
      fromHolder.updatedAt = event.block.timestamp;
      fromHolder.save();
    }
  }

  // Process recipient (unless burn)
  if (toAddr != ZERO_ADDRESS) {
    let toHolderId = tokenAddr + "-" + toAddr;
    let toHolder = TokenHolder.load(toHolderId);
    if (toHolder == null) {
      toHolder = new TokenHolder(toHolderId);
      toHolder.token = event.address;
      toHolder.account = event.params.to;
      toHolder.balance = BigInt.zero();
    }
    toHolder.balance = toHolder.balance.plus(value);
    toHolder.updatedAt = event.block.timestamp;
    toHolder.save();
  }
}

export function handleDelegateChanged(event: DelegateChanged): void {
  let tokenAddr = event.address.toHexString().toLowerCase();
  let delegator = event.params.delegator;
  let toDelegate = event.params.toDelegate;

  let delegateId = tokenAddr + "-" + delegator.toHexString().toLowerCase();
  let delegateEntity = Delegate.load(delegateId);
  if (delegateEntity == null) {
    delegateEntity = new Delegate(delegateId);
    delegateEntity.token = event.address;
    delegateEntity.delegator = delegator;
    delegateEntity.votingPower = BigInt.zero();
  }
  delegateEntity.delegatee = toDelegate;
  delegateEntity.updatedAt = event.block.timestamp;
  delegateEntity.save();
}

export function handleDelegateVotesChanged(event: DelegateVotesChanged): void {
  let tokenAddr = event.address.toHexString().toLowerCase();
  let delegateAddress = event.params.delegate;

  let delegateId = tokenAddr + "-" + delegateAddress.toHexString().toLowerCase();
  let delegateEntity = Delegate.load(delegateId);
  if (delegateEntity == null) {
    delegateEntity = new Delegate(delegateId);
    delegateEntity.token = event.address;
    delegateEntity.delegator = delegateAddress;
    delegateEntity.delegatee = delegateAddress;
  }
  delegateEntity.votingPower = event.params.newVotes;
  delegateEntity.updatedAt = event.block.timestamp;
  delegateEntity.save();
}
