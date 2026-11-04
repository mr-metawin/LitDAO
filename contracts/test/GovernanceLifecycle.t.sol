// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DAORegistry} from "../src/DAORegistry.sol";
import {DAOToken} from "../src/DAOToken.sol";
import {TokenFactory} from "../src/TokenFactory.sol";
import {DAOGovernor} from "../src/DAOGovernor.sol";
import {GovernorDeployer} from "../src/GovernorDeployer.sol";
import {GovernorFactory} from "../src/GovernorFactory.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";

contract GovernanceLifecycleTest is Test {
    DAORegistry public registry;
    TokenFactory public tokenFactory;
    GovernorDeployer public deployer;
    GovernorFactory public governorFactory;

    address public owner = makeAddr("owner");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    address public dave = makeAddr("dave");

    DAOToken public token;
    DAOGovernor public governor;
    TimelockController public timelock;

    uint48 public constant VOTING_DELAY = 60; // 60 seconds
    uint32 public constant VOTING_PERIOD = 3600; // 1 hour (3600 seconds)
    uint256 public constant PROPOSAL_THRESHOLD = 0;
    uint256 public constant QUORUM_PERCENT = 4; // 4%
    uint256 public constant TIMELOCK_DELAY = 60; // 60 seconds
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;

    function setUp() public {
        vm.warp(1_700_000_000); // realistic timestamp

        // 1. Deploy registry
        vm.prank(owner);
        registry = new DAORegistry(owner);

        // 2. Deploy token factory
        tokenFactory = new TokenFactory();

        // 3. Deploy governor deployer & factory
        deployer = new GovernorDeployer();
        governorFactory = new GovernorFactory(address(registry), address(deployer));

        // 4. Authorize governor factory in registry
        vm.prank(owner);
        registry.setFactoryAuthorized(address(governorFactory), true);

        // 5. Alice deploys token with initial supply
        vm.prank(alice);
        address tokenAddr = tokenFactory.createToken("Lit Governance Token", "LIT", INITIAL_SUPPLY, alice);
        token = DAOToken(tokenAddr);

        // 6. Alice deploys governor + timelock
        GovernorFactory.GovernorParams memory params = GovernorFactory.GovernorParams({
            name: "Lumen",
            token: address(token),
            votingDelay: VOTING_DELAY,
            votingPeriod: VOTING_PERIOD,
            proposalThreshold: PROPOSAL_THRESHOLD,
            quorumFraction: QUORUM_PERCENT,
            timelockMinDelay: TIMELOCK_DELAY
        });

        vm.prank(alice);
        (address govAddr, address tlAddr) = governorFactory.createGovernor(params);
        governor = DAOGovernor(payable(govAddr));
        timelock = TimelockController(payable(tlAddr));

        // 7. Fund timelock treasury with 50,000 tokens
        vm.prank(alice);
        token.transfer(address(timelock), 50_000 ether);
    }

    // -------------------------------------------------------------------------
    // Factory Configuration & Role Setup Tests
    // -------------------------------------------------------------------------

    function test_TokenInitialDelegationAndRoles() public view {
        // Alice receives initial supply and is auto-delegated to herself
        assertEq(token.balanceOf(alice), INITIAL_SUPPLY - 50_000 ether);
        assertEq(token.getVotes(alice), INITIAL_SUPPLY - 50_000 ether);
        assertEq(token.delegates(alice), alice);

        // Alice holds DEFAULT_ADMIN_ROLE and MINTER_ROLE
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), alice));
        assertTrue(token.hasRole(token.MINTER_ROLE(), alice));
    }

    function test_TimelockRolesAndWiring() public view {
        // Governor has PROPOSER_ROLE and CANCELLER_ROLE
        assertTrue(timelock.hasRole(timelock.PROPOSER_ROLE(), address(governor)));
        assertTrue(timelock.hasRole(timelock.CANCELLER_ROLE(), address(governor)));

        // EXECUTOR_ROLE is open to address(0)
        assertTrue(timelock.hasRole(timelock.EXECUTOR_ROLE(), address(0)));

        // Factory has renounced DEFAULT_ADMIN_ROLE
        assertFalse(timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), address(governorFactory)));

        // Timelock is self-administered
        assertTrue(timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), address(timelock)));
    }

    function test_RegistryAutoRegistration() public view {
        assertTrue(registry.isGovernorRegistered(address(governor)));
        assertTrue(registry.isTokenRegistered(address(token)));

        DAORegistry.DAO memory dao = registry.getDAOByGovernor(address(governor));
        assertEq(dao.governor, address(governor));
        assertEq(dao.token, address(token));
        assertEq(dao.timelock, address(timelock));
        assertEq(dao.registrant, alice);
        assertEq(dao.name, "Lumen");
    }

    function test_RevertIf_InvalidGovernorParams() public {
        GovernorFactory.GovernorParams memory badParams = GovernorFactory.GovernorParams({
            name: "Bad",
            token: address(token),
            votingDelay: 60,
            votingPeriod: 0, // invalid 0 period
            proposalThreshold: 0,
            quorumFraction: 4,
            timelockMinDelay: 60
        });

        vm.expectRevert(GovernorFactory.InvalidVotingPeriod.selector);
        governorFactory.createGovernor(badParams);

        badParams.votingPeriod = 3600;
        badParams.quorumFraction = 0; // invalid 0 quorum
        vm.expectRevert(GovernorFactory.InvalidQuorumFraction.selector);
        governorFactory.createGovernor(badParams);

        badParams.quorumFraction = 101; // invalid > 100 quorum
        vm.expectRevert(GovernorFactory.InvalidQuorumFraction.selector);
        governorFactory.createGovernor(badParams);
    }

    // -------------------------------------------------------------------------
    // Full Proposal Lifecycle Test
    // -------------------------------------------------------------------------

    function test_FullProposalLifecycle_Success() public {
        // 1. Propose: Transfer 5,000 tokens from Timelock to Bob
        address[] memory targets = new address[](1);
        targets[0] = address(token);

        uint256[] memory values = new uint256[](1);
        values[0] = 0;

        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(token.transfer.selector, bob, 5_000 ether);

        string memory description = "Proposal #1: Send 5000 LIT to Bob";
        bytes32 descriptionHash = keccak256(bytes(description));

        // Advance 2 seconds to make sure checkpoint is older than current block
        vm.warp(block.timestamp + 2);

        vm.prank(alice);
        uint256 proposalId = governor.propose(targets, values, calldatas, description);

        // Proposal is initially Pending during voting delay
        assertEq(uint256(governor.state(proposalId)), uint256(IGovernor.ProposalState.Pending));

        // 2. Warp past voting delay (60s) -> State becomes Active
        vm.warp(block.timestamp + VOTING_DELAY + 1);
        assertEq(uint256(governor.state(proposalId)), uint256(IGovernor.ProposalState.Active));

        // 3. Alice votes For (support = 1)
        vm.prank(alice);
        governor.castVote(proposalId, 1);

        // Verify tallies update live
        (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) = governor.proposalVotes(proposalId);
        assertEq(againstVotes, 0);
        assertEq(forVotes, token.getVotes(alice));
        assertEq(abstainVotes, 0);

        // 4. Warp past voting period (3600s) -> State becomes Succeeded
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        assertEq(uint256(governor.state(proposalId)), uint256(IGovernor.ProposalState.Succeeded));

        // 5. Anyone can queue proposal
        vm.prank(charlie);
        governor.queue(targets, values, calldatas, descriptionHash);
        assertEq(uint256(governor.state(proposalId)), uint256(IGovernor.ProposalState.Queued));

        // Execution before timelock delay reverts
        vm.prank(dave);
        vm.expectRevert();
        governor.execute(targets, values, calldatas, descriptionHash);

        // 6. Warp past timelock delay (60s)
        vm.warp(block.timestamp + TIMELOCK_DELAY + 1);

        // 7. Anyone can execute proposal
        uint256 bobBalBefore = token.balanceOf(bob);
        uint256 treasuryBalBefore = token.balanceOf(address(timelock));

        vm.prank(dave);
        governor.execute(targets, values, calldatas, descriptionHash);

        assertEq(uint256(governor.state(proposalId)), uint256(IGovernor.ProposalState.Executed));
        assertEq(token.balanceOf(bob), bobBalBefore + 5_000 ether);
        assertEq(token.balanceOf(address(timelock)), treasuryBalBefore - 5_000 ether);
    }

    // -------------------------------------------------------------------------
    // Delegation Before vs After Snapshot Test
    // -------------------------------------------------------------------------

    function test_DelegationBeforeVsAfterSnapshot() public {
        // Send tokens to Charlie and Dave
        vm.startPrank(alice);
        token.transfer(charlie, 10_000 ether);
        token.transfer(dave, 10_000 ether);
        vm.stopPrank();

        // Charlie delegates BEFORE snapshot
        vm.prank(charlie);
        token.delegate(charlie);

        // Advance time and create proposal
        vm.warp(block.timestamp + 5);

        address[] memory targets = new address[](1);
        targets[0] = address(token);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(token.transfer.selector, bob, 100 ether);
        string memory desc = "Proposal: Check snapshots";

        vm.prank(alice);
        uint256 proposalId = governor.propose(targets, values, calldatas, desc);

        // Warp past voting delay to finalize snapshot
        vm.warp(block.timestamp + VOTING_DELAY + 1);

        // Dave delegates AFTER snapshot has already passed
        vm.prank(dave);
        token.delegate(dave);

        // Charlie has 10,000 votes on this proposal
        vm.prank(charlie);
        uint256 charlieWeight = governor.castVote(proposalId, 1);
        assertEq(charlieWeight, 10_000 ether);

        // Dave has 0 votes on this proposal because snapshot was before his delegation!
        vm.prank(dave);
        uint256 daveWeight = governor.castVote(proposalId, 1);
        assertEq(daveWeight, 0);
    }

    // -------------------------------------------------------------------------
    // Defeated Proposal Test (Against > For)
    // -------------------------------------------------------------------------

    function test_ProposalDefeated_MoreAgainstVotes() public {
        // Give Bob more votes than Charlie
        vm.startPrank(alice);
        token.transfer(charlie, 10_000 ether);
        token.transfer(bob, 20_000 ether);
        vm.stopPrank();

        vm.prank(charlie);
        token.delegate(charlie);
        vm.prank(bob);
        token.delegate(bob);

        vm.warp(block.timestamp + 5);

        address[] memory targets = new address[](1);
        targets[0] = address(token);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(token.transfer.selector, bob, 100 ether);
        string memory desc = "Proposal: Defeated by Against";

        vm.prank(alice);
        uint256 proposalId = governor.propose(targets, values, calldatas, desc);

        vm.warp(block.timestamp + VOTING_DELAY + 1);

        // Charlie votes For (10k)
        vm.prank(charlie);
        governor.castVote(proposalId, 1);

        // Bob votes Against (20k, support = 0)
        vm.prank(bob);
        governor.castVote(proposalId, 0);

        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        // State is Defeated
        assertEq(uint256(governor.state(proposalId)), uint256(IGovernor.ProposalState.Defeated));

        // Queue must revert
        vm.expectRevert();
        governor.queue(targets, values, calldatas, keccak256(bytes(desc)));
    }

    // -------------------------------------------------------------------------
    // Quorum Failure Test (For > Against, but Quorum not reached)
    // -------------------------------------------------------------------------

    function test_ProposalDefeated_QuorumNotReached() public {
        // Quorum is 4% of 1,000,000 = 40,000 votes.
        // Give Charlie only 5,000 votes.
        vm.prank(alice);
        token.transfer(charlie, 5_000 ether);

        vm.prank(charlie);
        token.delegate(charlie);

        vm.warp(block.timestamp + 5);

        address[] memory targets = new address[](1);
        targets[0] = address(token);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(token.transfer.selector, bob, 100 ether);
        string memory desc = "Proposal: Quorum fail";

        vm.prank(alice);
        uint256 proposalId = governor.propose(targets, values, calldatas, desc);

        vm.warp(block.timestamp + VOTING_DELAY + 1);

        // Only Charlie votes For (5,000 votes < 40,000 quorum)
        vm.prank(charlie);
        governor.castVote(proposalId, 1);

        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        // Defeated because quorum was not reached
        assertEq(uint256(governor.state(proposalId)), uint256(IGovernor.ProposalState.Defeated));
    }

    // -------------------------------------------------------------------------
    // Fuzz Testing: Vote counts and Tallies
    // -------------------------------------------------------------------------

    function testFuzz_VotingTallies(uint32 forShare, uint32 againstShare) public {
        vm.assume(forShare > 0 && againstShare > 0);
        vm.assume(forShare < 500_000 && againstShare < 500_000);

        uint256 forAmount = uint256(forShare) * 1 ether;
        uint256 againstAmount = uint256(againstShare) * 1 ether;

        vm.startPrank(alice);
        token.transfer(charlie, forAmount);
        token.transfer(dave, againstAmount);
        vm.stopPrank();

        vm.prank(charlie);
        token.delegate(charlie);
        vm.prank(dave);
        token.delegate(dave);

        vm.warp(block.timestamp + 5);

        address[] memory targets = new address[](1);
        targets[0] = address(token);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(token.transfer.selector, bob, 1 ether);
        string memory desc = "Fuzz Proposal";

        vm.prank(alice);
        uint256 proposalId = governor.propose(targets, values, calldatas, desc);

        vm.warp(block.timestamp + VOTING_DELAY + 1);

        vm.prank(charlie);
        governor.castVote(proposalId, 1);

        vm.prank(dave);
        governor.castVote(proposalId, 0);

        (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) = governor.proposalVotes(proposalId);
        assertEq(forVotes, forAmount);
        assertEq(againstVotes, againstAmount);
        assertEq(abstainVotes, 0);
    }
}
