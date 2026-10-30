#!/usr/bin/env bash
set -e

# liteforge LiteForge Explorer Verification Commands
EXPLORER_API="https://liteforge.explorer.caldera.xyz/api"

echo "=== Verifying DAORegistry ==="
forge verify-contract 0xfF8c3453f5617C0483e3D2f38F70126772D6F247 src/DAORegistry.sol:DAORegistry \
  --verifier-url "$EXPLORER_API" \
  --verifier etherscan \
  --etherscan-api-key none \
  --constructor-args $(cast abi-encode "constructor(address)" 0x7a0BD8E647e6fa7A8B23d1E926F4C0ef03332A01) || true

echo "=== Verifying TokenFactory ==="
forge verify-contract 0x9b3E75Df9bBBCD2b60645ecb473d838f3eAa5dea src/TokenFactory.sol:TokenFactory \
  --verifier-url "$EXPLORER_API" \
  --verifier etherscan \
  --etherscan-api-key none || true

echo "=== Verifying GovernorDeployer ==="
forge verify-contract 0xA2913242e845D883df43676C0e253D9eDc0605B2 src/GovernorDeployer.sol:GovernorDeployer \
  --verifier-url "$EXPLORER_API" \
  --verifier etherscan \
  --etherscan-api-key none || true

echo "=== Verifying GovernorFactory ==="
forge verify-contract 0xfE6e5f87AA0be25c73BeF342217F2b170C9e38a2 src/GovernorFactory.sol:GovernorFactory \
  --verifier-url "$EXPLORER_API" \
  --verifier etherscan \
  --etherscan-api-key none \
  --constructor-args $(cast abi-encode "constructor(address,address)" 0xfF8c3453f5617C0483e3D2f38F70126772D6F247 0xA2913242e845D883df43676C0e253D9eDc0605B2) || true

echo "=== Verifying FaucetFactory ==="
forge verify-contract 0x01aD919d404Cd4a67F990499753fEBB78d21ED6b src/FaucetFactory.sol:FaucetFactory \
  --verifier-url "$EXPLORER_API" \
  --verifier etherscan \
  --etherscan-api-key none || true

echo "=== Verifying Demo Token ==="
forge verify-contract 0x6d6bd0Ecf6b3baB9f86ce0AAeD51fe2212288d39 src/DAOToken.sol:DAOToken \
  --verifier-url "$EXPLORER_API" \
  --verifier etherscan \
  --etherscan-api-key none \
  --constructor-args $(cast abi-encode "constructor(string,string,uint256,address)" "LitForge Governance Token" "LFT" 1000000000000000000000000 0x7a0BD8E647e6fa7A8B23d1E926F4C0ef03332A01) || true
