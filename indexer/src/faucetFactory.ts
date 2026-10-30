import { BigInt } from "@graphprotocol/graph-ts";
import { FaucetCreated } from "../generated/FaucetFactory/FaucetFactory";
import { Faucet } from "../generated/schema";
import { FaucetTemplate } from "../generated/templates";

export function handleFaucetCreated(event: FaucetCreated): void {
  let faucetAddr = event.params.faucet;
  let faucetId = faucetAddr.toHexString().toLowerCase();

  let faucet = Faucet.load(faucetId);
  if (faucet == null) {
    faucet = new Faucet(faucetId);
    faucet.token = event.params.token;
    faucet.admin = event.params.admin;
    faucet.mode = event.params.mode == 0 ? "MINT" : "PRE_FUNDED";
    faucet.claimCount = BigInt.zero();
    faucet.totalClaimed = BigInt.zero();
    faucet.createdAt = event.block.timestamp;
    faucet.save();

    // Dynamically spawn template to index claims
    FaucetTemplate.create(faucetAddr);
  }
}
