// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {GovernorDeployer} from "./GovernorDeployer.sol";
import {DAORegistry} from "./DAORegistry.sol";

/**
 * @title GovernorFactory
 * @notice Orchestrates deployment and permission wiring for TimelockController
 *         and DAOGovernor, then automatically registers the DAO in DAORegistry.
 * @dev Delegates DAOGovernor deployment to GovernorDeployer to stay within 24KB limit.
 */
contract GovernorFactory {
    struct GovernorParams {
        string name;
        address token;
        uint48 votingDelay; // in seconds (e.g. 60)
        uint32 votingPeriod; // in seconds (e.g. 3600 = 1 hour)
        uint256 proposalThreshold; // min tokens required to create proposal
        uint256 quorumFraction; // percent of total supply needed for quorum (e.g. 4 for 4%)
        uint256 timelockMinDelay; // timelock delay in seconds (e.g. 60)
    }

    struct GovernorInfo {
        address governor;
        address timelock;
        address token;
        address creator;
        string name;
        uint256 createdAt;
    }

    DAORegistry public immutable registry;
    GovernorDeployer public immutable deployer;

    /// @notice List of all deployed governors
    GovernorInfo[] private _governors;

    /// @notice Tracks whether governor was created by this factory
    mapping(address => bool) public isCreatedGovernor;

    /// @notice Creator address => governors created by creator
    mapping(address => address[]) private _governorsByCreator;

    event GovernorCreated(
        address indexed governor,
        address timelock,
        address indexed token,
        address indexed creator,
        string name
    );

    error InvalidRegistryAddress();
    error InvalidDeployerAddress();
    error InvalidTokenAddress();
    error InvalidVotingPeriod();
    error InvalidQuorumFraction();

    constructor(address registryAddress, address deployerAddress) {
        if (registryAddress == address(0)) revert InvalidRegistryAddress();
        if (deployerAddress == address(0)) revert InvalidDeployerAddress();
        registry = DAORegistry(registryAddress);
        deployer = GovernorDeployer(deployerAddress);
    }

    /**
     * @notice Deploy a Timelock + DAOGovernor system and register in DAORegistry
     * @param params Governor configuration parameters
     * @return governor Address of the deployed DAOGovernor
     * @return timelock Address of the deployed TimelockController
     */
    function createGovernor(GovernorParams calldata params)
        external
        returns (address governor, address timelock)
    {
        if (params.token == address(0) || params.token.code.length == 0) {
            revert InvalidTokenAddress();
        }
        if (params.votingPeriod == 0) {
            revert InvalidVotingPeriod();
        }
        if (params.quorumFraction == 0 || params.quorumFraction > 100) {
            revert InvalidQuorumFraction();
        }

        // 1. Deploy TimelockController with factory as temporary admin
        address[] memory proposers = new address[](0);
        address[] memory executors = new address[](0);

        TimelockController timelockContract = new TimelockController(
            params.timelockMinDelay,
            proposers,
            executors,
            address(this) // factory is temporary admin during setup
        );
        timelock = address(timelockContract);

        // 2. Deploy DAOGovernor via GovernorDeployer
        governor = deployer.deployGovernor(
            IVotes(params.token),
            timelockContract,
            params.name,
            params.votingDelay,
            params.votingPeriod,
            params.proposalThreshold,
            params.quorumFraction
        );

        // 3. Grant PROPOSER_ROLE and CANCELLER_ROLE to the Governor
        timelockContract.grantRole(timelockContract.PROPOSER_ROLE(), governor);
        timelockContract.grantRole(timelockContract.CANCELLER_ROLE(), governor);

        // 4. Grant EXECUTOR_ROLE to address(0) (anyone can execute queued proposals after delay)
        timelockContract.grantRole(timelockContract.EXECUTOR_ROLE(), address(0));

        // 5. Renounce factory's admin role on Timelock (self-administration only)
        timelockContract.renounceRole(timelockContract.DEFAULT_ADMIN_ROLE(), address(this));

        // 6. Auto-register DAO in DAORegistry with msg.sender as the creator
        registry.registerDAOFromFactory(governor, msg.sender);

        // Record tracking data
        GovernorInfo memory info = GovernorInfo({
            governor: governor,
            timelock: timelock,
            token: params.token,
            creator: msg.sender,
            name: params.name,
            createdAt: block.timestamp
        });

        _governors.push(info);
        isCreatedGovernor[governor] = true;
        _governorsByCreator[msg.sender].push(governor);

        emit GovernorCreated(governor, timelock, params.token, msg.sender, params.name);
    }

    /**
     * @notice Total number of governors created
     */
    function getGovernorCount() external view returns (uint256) {
        return _governors.length;
    }

    /**
     * @notice Paginated retrieval of governors created
     */
    function getGovernors(uint256 offset, uint256 limit)
        external
        view
        returns (GovernorInfo[] memory)
    {
        uint256 total = _governors.length;
        if (offset >= total || limit == 0) {
            return new GovernorInfo[](0);
        }

        uint256 end;
        if (limit > total - offset) {
            end = total;
        } else {
            end = offset + limit;
        }

        uint256 size = end - offset;
        GovernorInfo[] memory result = new GovernorInfo[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = _governors[offset + i];
        }

        return result;
    }

    /**
     * @notice Retrieve governors created by a specific creator
     */
    function getGovernorsByCreator(address creator) external view returns (address[] memory) {
        return _governorsByCreator[creator];
    }
}
