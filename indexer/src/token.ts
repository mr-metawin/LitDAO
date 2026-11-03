import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  Transfer,
  DelegateChanged,
  DelegateVotesChanged
} from "../generated/templates/TokenTemplate/DAOToken";
import { TokenHolder, Delegate, DAO, TokenDAO } from "../generated/schema";

let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function handleTransfer(event: Transfer): void {
  let tokenAddr = event.address.toHexString().toLowerCase();
  let fromAddr = event.params.from.toHexString().toLowerCase();
  let toAddr = event.params.to.toHexString().toLowerCase();
  let value = event.params.value;

  // Ignore 0-value transfers or transfers to self
  if (value.equals(BigInt.zero()) || fromAddr == toAddr) {
    return;
  }

  let tokenDao = TokenDAO.load(tokenAddr);
  if (tokenDao == null) {
    tokenDao = new TokenDAO(tokenAddr);
    tokenDao.holderCount = BigInt.zero();
  }

  // Process sender (unless mint)
  if (fromAddr != ZERO_ADDRESS) {
    let fromHolderId = tokenAddr + "-" + fromAddr;
    let fromHolder = TokenHolder.load(fromHolderId);
    if (fromHolder != null) {
      let prevBalance = fromHolder.balance;
      let newBalance = prevBalance.minus(value);
      fromHolder.balance = newBalance;
      fromHolder.updatedAt = event.block.timestamp;
      fromHolder.save();

      if (prevBalance.gt(BigInt.zero()) && newBalance.equals(BigInt.zero())) {
        if (tokenDao.holderCount.gt(BigInt.zero())) {
          tokenDao.holderCount = tokenDao.holderCount.minus(BigInt.fromI32(1));
        }
      }
    }
  }

  // Process recipient (unless burn)
  if (toAddr != ZERO_ADDRESS) {
    let toHolderId = tokenAddr + "-" + toAddr;
    let toHolder = TokenHolder.load(toHolderId);
    let prevBalance = BigInt.zero();
    if (toHolder == null) {
      toHolder = new TokenHolder(toHolderId);
      toHolder.token = event.address;
      toHolder.account = event.params.to;
      toHolder.balance = BigInt.zero();
    } else {
      prevBalance = toHolder.balance;
    }
    let newBalance = prevBalance.plus(value);
    toHolder.balance = newBalance;
    toHolder.updatedAt = event.block.timestamp;
    toHolder.save();

    if (prevBalance.equals(BigInt.zero()) && newBalance.gt(BigInt.zero())) {
      tokenDao.holderCount = tokenDao.holderCount.plus(BigInt.fromI32(1));
    }
  }

  tokenDao.save();

  // If this token is linked to a DAO, synchronize dao.holderCount
  if (tokenDao.dao != null) {
    let dao = DAO.load(tokenDao.dao!);
    if (dao != null) {
      dao.holderCount = tokenDao.holderCount;
      dao.save();
    }
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
