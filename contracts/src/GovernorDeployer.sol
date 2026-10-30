// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DAOGovernor} from "./DAOGovernor.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";

/**
 * @title GovernorDeployer
 * @notice Dedicated deployer contract for DAOGovernor instances.
 * @dev Isolates DAOGovernor bytecode from GovernorFactory to prevent exceeding
 *      the 24,576 byte EIP-170 code size limit on the factory.
 */
contract GovernorDeployer {
    function deployGovernor(
        IVotes token,
        TimelockController timelock,
        string memory name,
        uint48 votingDelay,
        uint32 votingPeriod,
        uint256 proposalThreshold,
        uint256 quorumFraction
    ) external returns (address) {
        DAOGovernor governor = new DAOGovernor(
            token,
            timelock,
            name,
            votingDelay,
            votingPeriod,
            proposalThreshold,
            quorumFraction
        );
        return address(governor);
    }
}
