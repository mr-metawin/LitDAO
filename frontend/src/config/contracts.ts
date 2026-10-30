import daoRegistryAbi from '../abis/DAORegistry.json';
import tokenFactoryAbi from '../abis/TokenFactory.json';
import governorFactoryAbi from '../abis/GovernorFactory.json';
import faucetFactoryAbi from '../abis/FaucetFactory.json';
import daoTokenAbi from '../abis/DAOToken.json';
import daoGovernorAbi from '../abis/DAOGovernor.json';
import daoFaucetAbi from '../abis/DAOFaucet.json';
import timelockAbi from '../abis/TimelockController.json';

export const CONTRACT_ADDRESSES = {
  daoRegistry: '0xfF8c3453f5617C0483e3D2f38F70126772D6F247' as `0x${string}`,
  tokenFactory: '0x9b3E75Df9bBBCD2b60645ecb473d838f3eAa5dea' as `0x${string}`,
  governorDeployer: '0xA2913242e845D883df43676C0e253D9eDc0605B2' as `0x${string}`,
  governorFactory: '0xfE6e5f87AA0be25c73BeF342217F2b170C9e38a2' as `0x${string}`,
  faucetFactory: '0x01aD919d404Cd4a67F990499753fEBB78d21ED6b' as `0x${string}`,
  demoToken: '0x6d6bd0Ecf6b3baB9f86ce0AAeD51fe2212288d39' as `0x${string}`,
  demoGovernor: '0x1CB597537cEc0efFB292a16010719b8FC04548F4' as `0x${string}`,
  demoTimelock: '0xB293fF6fc141225D13eA4eA7C5EA9fbcc84fa038' as `0x${string}`,
  demoFaucet: '0x42877a1de0eAD2415Ff4A9394EB11244FD5CEF0d' as `0x${string}`,
};

export const ABIS = {
  daoRegistry: daoRegistryAbi,
  tokenFactory: tokenFactoryAbi,
  governorFactory: governorFactoryAbi,
  faucetFactory: faucetFactoryAbi,
  daoToken: daoTokenAbi,
  daoGovernor: daoGovernorAbi,
  daoFaucet: daoFaucetAbi,
  timelock: timelockAbi,
};
