// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DAORegistry} from "../src/DAORegistry.sol";
import {
    MockToken,
    MockGovernor,
    MockGovernorRevertingToken,
    MockGovernorNonContractToken
} from "./mocks/MockContracts.sol";

contract DAORegistryTest is Test {
    DAORegistry public registry;

    address public owner = makeAddr("owner");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public factory = makeAddr("factory");
    address public timelock = makeAddr("timelock");

    MockToken public token1;
    MockToken public token2;
    MockGovernor public gov1;
    MockGovernor public gov2;

    event DAORegistered(address indexed governor, address indexed token, address indexed registrant);
    event FactoryAuthorizationUpdated(address indexed factory, bool authorized);

    function setUp() public {
        registry = new DAORegistry(owner);

        token1 = new MockToken("Token One", "TK1");
        token2 = new MockToken("Token Two", "TK2");

        // Set Alice as owner of both tokens for registration permission tests
        token1.setOwner(alice);
        token2.setOwner(alice);

        gov1 = new MockGovernor(address(token1), timelock, "DAO One");
        gov2 = new MockGovernor(address(token2), timelock, "DAO Two");
    }

    function test_InitialState() public view {
        assertEq(registry.owner(), owner);
        assertEq(registry.getDAOCount(), 0);
    }

    function test_RegisterDAOSuccess() public {
        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit DAORegistered(address(gov1), address(token1), alice);

        DAORegistry.DAO memory dao = registry.registerDAO(address(gov1));

        assertEq(dao.governor, address(gov1));
        assertEq(dao.token, address(token1));
        assertEq(dao.timelock, timelock);
        assertEq(dao.registrant, alice);
        assertEq(dao.name, "DAO One");
        assertEq(dao.timestamp, block.timestamp);

        assertTrue(registry.isGovernorRegistered(address(gov1)));
        assertTrue(registry.isTokenRegistered(address(token1)));
        assertTrue(registry.hasRegistered(alice));
        assertEq(registry.getDAOCount(), 1);

        DAORegistry.DAO memory fetched = registry.getDAOByGovernor(address(gov1));
        assertEq(fetched.governor, address(gov1));
        assertEq(fetched.token, address(token1));

        DAORegistry.DAO memory fetchedByToken = registry.getDAOByToken(address(token1));
        assertEq(fetchedByToken.governor, address(gov1));
    }

    function test_RevertIf_DirectRegistrantNotTokenAdmin() public {
        // Bob tries to register Alice's token to grief or block it
        vm.prank(bob);
        vm.expectRevert(DAORegistry.NotTokenAdmin.selector);
        registry.registerDAO(address(gov1));
    }

    function test_RevertIf_DAONotFound() public {
        vm.expectRevert(DAORegistry.DAONotFound.selector);
        registry.getDAOByGovernor(address(gov1));

        vm.expectRevert(DAORegistry.DAONotFound.selector);
        registry.getDAOByToken(address(token1));
    }

    function test_RevertIf_GovernorNotContract() public {
        address nonContract = makeAddr("nonContract");
        vm.prank(alice);
        vm.expectRevert(DAORegistry.GovernorNotContract.selector);
        registry.registerDAO(nonContract);
    }

    function test_RevertIf_TokenMethodReverts() public {
        MockGovernorRevertingToken badGov = new MockGovernorRevertingToken();
        vm.prank(alice);
        vm.expectRevert(DAORegistry.InvalidGovernorToken.selector);
        registry.registerDAO(address(badGov));
    }

    function test_RevertIf_TokenNotContract() public {
        MockGovernorNonContractToken badGov = new MockGovernorNonContractToken(makeAddr("someEOA"));
        vm.prank(alice);
        vm.expectRevert(DAORegistry.InvalidGovernorToken.selector);
        registry.registerDAO(address(badGov));
    }

    function test_RevertIf_SenderAlreadyRegistered() public {
        vm.prank(alice);
        registry.registerDAO(address(gov1));

        vm.prank(alice);
        vm.expectRevert(DAORegistry.SenderAlreadyRegistered.selector);
        registry.registerDAO(address(gov2));
    }

    function test_RevertIf_GovernorAlreadyRegistered() public {
        vm.prank(alice);
        registry.registerDAO(address(gov1));

        // Transfer token ownership to Bob to test governor duplication specifically
        token1.setOwner(bob);
        vm.prank(bob);
        vm.expectRevert(DAORegistry.GovernorAlreadyRegistered.selector);
        registry.registerDAO(address(gov1));
    }

    function test_RevertIf_TokenAlreadyRegistered() public {
        vm.prank(alice);
        registry.registerDAO(address(gov1));

        // Different governor using the same token
        MockGovernor govWithSameToken = new MockGovernor(address(token1), timelock, "DAO Duplicate Token");

        token1.setOwner(bob);
        vm.prank(bob);
        vm.expectRevert(DAORegistry.TokenAlreadyRegistered.selector);
        registry.registerDAO(address(govWithSameToken));
    }

    function test_FactoryAuthorizationAndRegistration() public {
        // Authorize factory
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit FactoryAuthorizationUpdated(factory, true);
        registry.setFactoryAuthorized(factory, true);
        assertTrue(registry.isFactoryAuthorized(factory));

        // Factory registers first DAO on behalf of Alice
        vm.prank(factory);
        DAORegistry.DAO memory dao1 = registry.registerDAOFromFactory(address(gov1), alice);
        assertEq(dao1.registrant, alice);

        // Factory can register a second DAO on behalf of Bob (bypasses 1-per-sender for factory)
        vm.prank(factory);
        DAORegistry.DAO memory dao2 = registry.registerDAOFromFactory(address(gov2), bob);
        assertEq(dao2.registrant, bob);

        assertEq(registry.getDAOCount(), 2);
    }

    function test_RevertIf_UnauthorizedFactoryRegisters() public {
        vm.prank(bob);
        vm.expectRevert(DAORegistry.FactoryNotAuthorized.selector);
        registry.registerDAOFromFactory(address(gov1), alice);
    }

    function test_RevertIf_FactoryPassesZeroCreator() public {
        vm.prank(owner);
        registry.setFactoryAuthorized(factory, true);

        vm.prank(factory);
        vm.expectRevert(DAORegistry.InvalidCreatorAddress.selector);
        registry.registerDAOFromFactory(address(gov1), address(0));
    }

    function test_OnlyOwnerCanAuthorizeFactory() public {
        vm.prank(bob);
        vm.expectRevert();
        registry.setFactoryAuthorized(factory, true);
    }

    function test_Pagination() public {
        // Authorize factory to register multiple DAOs
        vm.prank(owner);
        registry.setFactoryAuthorized(factory, true);

        // Create 5 DAOs
        for (uint256 i = 0; i < 5; i++) {
            MockToken tk = new MockToken("Test", "TST");
            MockGovernor g = new MockGovernor(address(tk), timelock, "TestGov");
            vm.prank(factory);
            registry.registerDAOFromFactory(address(g), alice);
        }

        assertEq(registry.getDAOCount(), 5);

        // Fetch first page: offset 0, limit 2
        DAORegistry.DAO[] memory page1 = registry.getDAOs(0, 2);
        assertEq(page1.length, 2);

        // Fetch second page: offset 2, limit 2
        DAORegistry.DAO[] memory page2 = registry.getDAOs(2, 2);
        assertEq(page2.length, 2);

        // Fetch third page: offset 4, limit 2 (only 1 remaining)
        DAORegistry.DAO[] memory page3 = registry.getDAOs(4, 2);
        assertEq(page3.length, 1);

        // Offset beyond length returns empty
        DAORegistry.DAO[] memory emptyPage = registry.getDAOs(5, 2);
        assertEq(emptyPage.length, 0);

        // Limit = 0 returns empty
        DAORegistry.DAO[] memory zeroLimit = registry.getDAOs(0, 0);
        assertEq(zeroLimit.length, 0);
    }

    // Fuzz test: verify pagination never reverts regardless of offset and limit
    function testFuzz_Pagination(uint256 offset, uint256 limit) public {
        vm.prank(owner);
        registry.setFactoryAuthorized(factory, true);

        // Register 3 DAOs
        for (uint256 i = 0; i < 3; i++) {
            MockToken tk = new MockToken("Token", "TK");
            MockGovernor g = new MockGovernor(address(tk), timelock, "Gov");
            vm.prank(factory);
            registry.registerDAOFromFactory(address(g), alice);
        }

        DAORegistry.DAO[] memory result = registry.getDAOs(offset, limit);

        if (offset >= 3 || limit == 0) {
            assertEq(result.length, 0);
        } else {
            uint256 expected = 3 - offset;
            if (expected > limit) {
                expected = limit;
            }
            assertEq(result.length, expected);
        }
    }

    // Fuzz test: unauthorized callers always revert on factory registration
    function testFuzz_UnauthorizedCallerCannotRegisterFactory(address caller, address creator) public {
        vm.assume(caller != factory && caller != address(0));
        vm.assume(creator != address(0));

        vm.prank(caller);
        vm.expectRevert(DAORegistry.FactoryNotAuthorized.selector);
        registry.registerDAOFromFactory(address(gov1), creator);
    }
}
