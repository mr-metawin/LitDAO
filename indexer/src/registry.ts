import { BigInt, Address } from "@graphprotocol/graph-ts";
import { DAORegistered } from "../generated/DAORegistry/DAORegistry";
import { DAOGovernor } from "../generated/DAORegistry/DAOGovernor";
import { DAO } from "../generated/schema";
import { GovernorTemplate, TokenTemplate } from "../generated/templates";

export function handleDAORegistered(event: DAORegistered): void {
  let governorAddr = event.params.governor;
  let tokenAddr = event.params.token;
  let registrant = event.params.registrant;

  let daoId = governorAddr.toHexString().toLowerCase();
  let dao = DAO.load(daoId);
  if (dao == null) {
    dao = new DAO(daoId);
    dao.governor = governorAddr;
    dao.token = tokenAddr;
    dao.registrant = registrant;
    dao.createdAt = event.block.timestamp;
    dao.createdBlock = event.block.number;
    dao.proposalCount = BigInt.zero();
    dao.voterCount = BigInt.zero();
    dao.holderCount = BigInt.zero();

    // Query name and timelock from governor contract
    let govContract = DAOGovernor.bind(governorAddr);
    let nameCall = govContract.try_name();
    if (!nameCall.reverted) {
      dao.name = nameCall.value;
    } else {
      dao.name = "DAO";
    }

    let timelockCall = govContract.try_timelock();
    if (!timelockCall.reverted) {
      dao.timelock = timelockCall.value;
    } else {
      dao.timelock = Address.zero();
    }

    dao.save();

    // Dynamically spawn templates
    GovernorTemplate.create(governorAddr);
    TokenTemplate.create(tokenAddr);
  }
}
