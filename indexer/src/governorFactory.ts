import { BigInt } from "@graphprotocol/graph-ts";
import { GovernorCreated } from "../generated/GovernorFactory/GovernorFactory";
import { DAO } from "../generated/schema";
import { GovernorTemplate, TokenTemplate } from "../generated/templates";

export function handleGovernorCreated(event: GovernorCreated): void {
  let governorAddr = event.params.governor;
  let timelockAddr = event.params.timelock;
  let tokenAddr = event.params.token;
  let creator = event.params.creator;
  let name = event.params.name;

  let daoId = governorAddr.toHexString().toLowerCase();
  let dao = DAO.load(daoId);
  if (dao == null) {
    dao = new DAO(daoId);
    dao.governor = governorAddr;
    dao.timelock = timelockAddr;
    dao.token = tokenAddr;
    dao.registrant = creator;
    dao.name = name;
    dao.createdAt = event.block.timestamp;
    dao.createdBlock = event.block.number;
    dao.proposalCount = BigInt.zero();
    dao.voterCount = BigInt.zero();
    dao.holderCount = BigInt.zero();
    dao.save();

    // Dynamically spawn templates
    GovernorTemplate.create(governorAddr);
    TokenTemplate.create(tokenAddr);
  } else {
    // If registered first via DAORegistry, ensure timelock & name are accurately set
    dao.timelock = timelockAddr;
    dao.name = name;
    dao.save();
  }
}
