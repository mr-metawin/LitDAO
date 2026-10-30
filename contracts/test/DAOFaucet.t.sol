// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DAOToken} from "../src/DAOToken.sol";
import {DAOFaucet} from "../src/DAOFaucet.sol";
import {FaucetFactory} from "../src/FaucetFactory.sol";

contract DAOFaucetTest is Test {
    DAOToken public token;
    DAOFaucet public mintFaucet;
    DAOFaucet public prefundedFaucet;
    FaucetFactory public factory;

    address public creator = makeAddr("creator");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 public constant CLAIM_AMOUNT = 100 ether;
    uint256 public constant COOLDOWN = 3600; // 1 hour (3600 seconds)

    event Claimed(address indexed user, uint256 amount, DAOFaucet.FaucetMode mode);
    event ClaimAmountUpdated(uint256 newAmount);
    event CooldownPeriodUpdated(uint256 newCooldown);
    event FaucetModeUpdated(DAOFaucet.FaucetMode newMode);
    event PauseToggled(bool isPaused);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event TokensWithdrawn(address indexed recipient, uint256 amount);
    event FaucetCreated(
        address indexed faucet,
        address indexed token,
        address indexed admin,
        DAOFaucet.FaucetMode mode
    );

    function setUp() public {
        vm.warp(1_700_000_000);

        // Creator deploys token
        vm.prank(creator);
        token = new DAOToken("Test Token", "TEST", INITIAL_SUPPLY, creator);

        // Deploy faucet factory
        factory = new FaucetFactory();

        vm.startPrank(creator);

        // Deploy Mint-mode faucet via factory
        address mintFaucetAddr = factory.createFaucet(
            address(token),
            CLAIM_AMOUNT,
            COOLDOWN,
            DAOFaucet.FaucetMode.MINT
        );
        mintFaucet = DAOFaucet(mintFaucetAddr);

        // Grant MINTER_ROLE to mintFaucet
        token.grantRole(token.MINTER_ROLE(), mintFaucetAddr);

        // Deploy Pre-funded faucet via factory
        address prefundedFaucetAddr = factory.createFaucet(
            address(token),
            CLAIM_AMOUNT,
            COOLDOWN,
            DAOFaucet.FaucetMode.PRE_FUNDED
        );
        prefundedFaucet = DAOFaucet(prefundedFaucetAddr);

        // Fund the pre-funded faucet with 5,000 tokens
        token.transfer(prefundedFaucetAddr, 5_000 ether);

        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Mint Mode Tests
    // -------------------------------------------------------------------------

    function test_MintMode_ClaimSuccess() public {
        (bool eligibleBefore, uint256 remainingBefore) = mintFaucet.canClaim(alice);
        assertTrue(eligibleBefore);
        assertEq(remainingBefore, 0);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit Claimed(alice, CLAIM_AMOUNT, DAOFaucet.FaucetMode.MINT);
        mintFaucet.claim();

        assertEq(token.balanceOf(alice), CLAIM_AMOUNT);
        assertEq(mintFaucet.lastClaimAt(alice), block.timestamp);
        assertEq(mintFaucet.totalClaimedBy(alice), CLAIM_AMOUNT);
        assertEq(mintFaucet.totalClaimed(), CLAIM_AMOUNT);

        // Immediately after claim, alice is on cooldown
        (bool eligibleAfter, uint256 remainingAfter) = mintFaucet.canClaim(alice);
        assertFalse(eligibleAfter);
        assertEq(remainingAfter, COOLDOWN);
    }

    function test_MintMode_RevertIf_CooldownNotElapsed() public {
        vm.prank(alice);
        mintFaucet.claim();

        // Alice tries to claim again immediately
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(DAOFaucet.CooldownNotElapsed.selector, COOLDOWN));
        mintFaucet.claim();

        // Warp 1800 seconds (half cooldown)
        vm.warp(block.timestamp + 1800);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(DAOFaucet.CooldownNotElapsed.selector, 1800));
        mintFaucet.claim();

        // Warp remaining 1800 seconds -> claim succeeds
        vm.warp(block.timestamp + 1800);
        vm.prank(alice);
        mintFaucet.claim();
        assertEq(token.balanceOf(alice), CLAIM_AMOUNT * 2);
    }

    // -------------------------------------------------------------------------
    // Pre-Funded Mode Tests
    // -------------------------------------------------------------------------

    function test_PrefundedMode_ClaimSuccess() public {
        uint256 faucetBalBefore = prefundedFaucet.getFaucetBalance();
        assertEq(faucetBalBefore, 5_000 ether);

        vm.prank(bob);
        vm.expectEmit(true, false, false, true);
        emit Claimed(bob, CLAIM_AMOUNT, DAOFaucet.FaucetMode.PRE_FUNDED);
        prefundedFaucet.claim();

        assertEq(token.balanceOf(bob), CLAIM_AMOUNT);
        assertEq(prefundedFaucet.getFaucetBalance(), faucetBalBefore - CLAIM_AMOUNT);
    }

    function test_PrefundedMode_RevertIf_InsufficientBalance() public {
        // Deploy an empty pre-funded faucet
        vm.prank(creator);
        address emptyFaucetAddr = factory.createFaucet(
            address(token),
            CLAIM_AMOUNT,
            COOLDOWN,
            DAOFaucet.FaucetMode.PRE_FUNDED
        );
        DAOFaucet emptyFaucet = DAOFaucet(emptyFaucetAddr);

        vm.prank(alice);
        vm.expectRevert(DAOFaucet.InsufficientFaucetBalance.selector);
        emptyFaucet.claim();
    }

    // -------------------------------------------------------------------------
    // Pause / Resume Tests
    // -------------------------------------------------------------------------

    function test_PauseAndResume() public {
        vm.prank(creator);
        mintFaucet.setPaused(true);
        assertTrue(mintFaucet.isPaused());

        (bool eligible, ) = mintFaucet.canClaim(alice);
        assertFalse(eligible);

        vm.prank(alice);
        vm.expectRevert(DAOFaucet.FaucetPaused.selector);
        mintFaucet.claim();

        // Resume
        vm.prank(creator);
        mintFaucet.setPaused(false);
        assertFalse(mintFaucet.isPaused());

        vm.prank(alice);
        mintFaucet.claim();
        assertEq(token.balanceOf(alice), CLAIM_AMOUNT);
    }

    // -------------------------------------------------------------------------
    // Admin Controls Tests
    // -------------------------------------------------------------------------

    function test_AdminUpdatesParameters() public {
        // Update claim amount
        vm.prank(creator);
        mintFaucet.setClaimAmount(250 ether);
        assertEq(mintFaucet.claimAmount(), 250 ether);

        // Update cooldown
        vm.prank(creator);
        mintFaucet.setCooldownPeriod(7200);
        assertEq(mintFaucet.cooldownPeriod(), 7200);

        // Update mode
        vm.prank(creator);
        mintFaucet.setMode(DAOFaucet.FaucetMode.PRE_FUNDED);
        assertEq(uint256(mintFaucet.mode()), uint256(DAOFaucet.FaucetMode.PRE_FUNDED));

        // Withdraw tokens from prefunded faucet
        uint256 creatorBalBefore = token.balanceOf(creator);
        vm.prank(creator);
        prefundedFaucet.withdrawTokens(creator, 1_000 ether);
        assertEq(token.balanceOf(creator), creatorBalBefore + 1_000 ether);
        assertEq(prefundedFaucet.getFaucetBalance(), 4_000 ether);

        // Transfer admin
        vm.prank(creator);
        mintFaucet.transferAdmin(bob);
        assertEq(mintFaucet.admin(), bob);
    }

    function test_RevertIf_NonAdminCallsAdminFunctions() public {
        vm.prank(alice);
        vm.expectRevert(DAOFaucet.NotAdmin.selector);
        mintFaucet.setClaimAmount(500 ether);

        vm.prank(alice);
        vm.expectRevert(DAOFaucet.NotAdmin.selector);
        mintFaucet.setCooldownPeriod(100);

        vm.prank(alice);
        vm.expectRevert(DAOFaucet.NotAdmin.selector);
        mintFaucet.setPaused(true);

        vm.prank(alice);
        vm.expectRevert(DAOFaucet.NotAdmin.selector);
        mintFaucet.transferAdmin(alice);

        vm.prank(alice);
        vm.expectRevert(DAOFaucet.NotAdmin.selector);
        prefundedFaucet.withdrawTokens(alice, 100 ether);
    }

    // -------------------------------------------------------------------------
    // Factory Enumeration Tests
    // -------------------------------------------------------------------------

    function test_FactoryTrackingAndPagination() public view {
        assertEq(factory.getFaucetCount(), 2);
        assertTrue(factory.isCreatedFaucet(address(mintFaucet)));
        assertTrue(factory.isCreatedFaucet(address(prefundedFaucet)));

        FaucetFactory.FaucetInfo[] memory allFaucets = factory.getFaucets(0, 10);
        assertEq(allFaucets.length, 2);
        assertEq(allFaucets[0].faucet, address(mintFaucet));
        assertEq(allFaucets[0].admin, creator);

        address[] memory creatorFaucets = factory.getFaucetsByCreator(creator);
        assertEq(creatorFaucets.length, 2);
    }

    // -------------------------------------------------------------------------
    // Fuzz Testing
    // -------------------------------------------------------------------------

    function testFuzz_Cooldown(uint32 warpSeconds) public {
        vm.assume(warpSeconds < 1_000_000);

        vm.prank(alice);
        mintFaucet.claim();

        vm.warp(block.timestamp + warpSeconds);

        if (warpSeconds < COOLDOWN) {
            uint256 expectedRemaining = COOLDOWN - warpSeconds;
            vm.prank(alice);
            vm.expectRevert(abi.encodeWithSelector(DAOFaucet.CooldownNotElapsed.selector, expectedRemaining));
            mintFaucet.claim();
        } else {
            vm.prank(alice);
            mintFaucet.claim();
            assertEq(token.balanceOf(alice), CLAIM_AMOUNT * 2);
        }
    }
}
