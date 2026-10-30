import { BigInt } from "@graphprotocol/graph-ts";
import { Claimed } from "../generated/templates/FaucetTemplate/DAOFaucet";
import { Faucet, FaucetClaim } from "../generated/schema";

export function handleClaimed(event: Claimed): void {
  let faucetAddr = event.address.toHexString().toLowerCase();
  let faucet = Faucet.load(faucetAddr);
  if (faucet != null) {
    faucet.claimCount = faucet.claimCount.plus(BigInt.fromI32(1));
    faucet.totalClaimed = faucet.totalClaimed.plus(event.params.amount);
    faucet.save();
  }

  let claimId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let claim = new FaucetClaim(claimId);
  claim.faucet = faucetAddr;
  claim.user = event.params.user;
  claim.amount = event.params.amount;
  claim.mode = event.params.mode == 0 ? "MINT" : "PRE_FUNDED";
  claim.timestamp = event.block.timestamp;
  claim.blockNumber = event.block.number;
  claim.save();
}
