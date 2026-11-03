import { BigInt } from "@graphprotocol/graph-ts";
import { GovernorCreated } from "../generated/GovernorFactory/GovernorFactory";
import { DAO, TokenDAO } from "../generated/schema";
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

    // Link token to DAO and initialize holderCount
    let tokenDaoId = tokenAddr.toHexString().toLowerCase();
    let tokenDao = TokenDAO.load(tokenDaoId);
    if (tokenDao == null) {
      tokenDao = new TokenDAO(tokenDaoId);
      tokenDao.holderCount = BigInt.zero();
    }
    tokenDao.dao = dao.id;
    tokenDao.save();

    dao.holderCount = tokenDao.holderCount;
    dao.save();

    // Dynamically spawn templates
    GovernorTemplate.create(governorAddr);
    TokenTemplate.create(tokenAddr);
  } else {
    // If registered first via DAORegistry, ensure timelock & name are accurately set
    dao.timelock = timelockAddr;
    dao.name = name;
    dao.save();

    // Ensure tokenDao link is established
    let tokenDaoId = tokenAddr.toHexString().toLowerCase();
    let tokenDao = TokenDAO.load(tokenDaoId);
    if (tokenDao != null) {
      tokenDao.dao = dao.id;
      tokenDao.save();
    }
  }
}
