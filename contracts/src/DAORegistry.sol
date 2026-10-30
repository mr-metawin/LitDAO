// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DAORegistry
 * @notice Central registry for DAOs on liteforge.
 * @dev Enforces 1 DAO per external user, unique governor, and unique token registration.
 *      Requires direct registrants to be the admin or owner of the token to prevent griefing.
 *      Authorized factories can auto-register DAOs skipping the 1-per-sender restriction.
 */
contract DAORegistry is Ownable {
    struct DAO {
        address governor;
        address token;
        address timelock;
        address registrant;
        string name;
        uint256 timestamp;
    }

    /// @notice Total registered DAOs in chronological order
    DAO[] private _daos;

    /// @notice Governor address => DAO details
    mapping(address => DAO) public daoByGovernor;

    /// @notice Token address => DAO details
    mapping(address => DAO) public daoByToken;

    /// @notice Tracks whether a governor has been registered
    mapping(address => bool) public isGovernorRegistered;

    /// @notice Tracks whether a token has been registered
    mapping(address => bool) public isTokenRegistered;

    /// @notice Tracks whether an address has already registered a DAO directly
    mapping(address => bool) public hasRegistered;

    /// @notice Approved factories allowed to auto-register DAOs
    mapping(address => bool) public isFactoryAuthorized;

    // Events
    event DAORegistered(address indexed governor, address indexed token, address indexed registrant);
    event FactoryAuthorizationUpdated(address indexed factory, bool authorized);

    // Custom errors
    error GovernorNotContract();
    error InvalidGovernorToken();
    error SenderAlreadyRegistered();
    error GovernorAlreadyRegistered();
    error TokenAlreadyRegistered();
    error FactoryNotAuthorized();
    error InvalidCreatorAddress();
    error NotTokenAdmin();
    error DAONotFound();

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Authorize or revoke a factory's permission to register DAOs
     * @param factory Factory address
     * @param authorized True to authorize, false to revoke
     */
    function setFactoryAuthorized(address factory, bool authorized) external onlyOwner {
        isFactoryAuthorized[factory] = authorized;
        emit FactoryAuthorizationUpdated(factory, authorized);
    }

    /**
     * @notice Register an existing Governor contract
     * @dev Reads the token from the governor's token() view method.
     *      Verifies that msg.sender is admin (AccessControl) or owner (Ownable) of the token.
     *      msg.sender must not have registered a DAO previously.
     * @param governor Address of the Governor contract
     */
    function registerDAO(address governor) external returns (DAO memory dao) {
        if (hasRegistered[msg.sender]) revert SenderAlreadyRegistered();
        hasRegistered[msg.sender] = true;

        dao = _register(governor, msg.sender);

        // Verify token control to prevent registration griefing
        if (!_isTokenAdmin(dao.token, msg.sender)) {
            revert NotTokenAdmin();
        }
    }

    /**
     * @notice Auto-register a DAO from an authorized factory
     * @dev Skips the 1-per-sender check for the factory and records creator as registrant.
     * @param governor Address of the Governor contract
     * @param creator Real creator address of the DAO
     */
    function registerDAOFromFactory(address governor, address creator) external returns (DAO memory) {
        if (!isFactoryAuthorized[msg.sender]) revert FactoryNotAuthorized();
        if (creator == address(0)) revert InvalidCreatorAddress();

        return _register(governor, creator);
    }

    /**
     * @dev Verifies msg.sender is either AccessControl default admin or Ownable owner
     */
    function _isTokenAdmin(address token, address sender) internal view returns (bool) {
        // 1. Try AccessControl: hasRole(bytes32(0), sender)
        (bool roleSuccess, bytes memory roleData) = token.staticcall(
            abi.encodeWithSignature("hasRole(bytes32,address)", bytes32(0), sender)
        );
        if (roleSuccess && roleData.length >= 32) {
            bool hasDefaultAdmin = abi.decode(roleData, (bool));
            if (hasDefaultAdmin) return true;
        }

        // 2. Try Ownable: owner() == sender
        (bool ownerSuccess, bytes memory ownerData) = token.staticcall(
            abi.encodeWithSignature("owner()")
        );
        if (ownerSuccess && ownerData.length >= 32) {
            address tokenOwner = abi.decode(ownerData, (address));
            if (tokenOwner == sender) return true;
        }

        return false;
    }

    /**
     * @dev Internal registration logic shared by direct and factory registration
     */
    function _register(address governor, address registrant) internal returns (DAO memory) {
        if (governor.code.length == 0) revert GovernorNotContract();
        if (isGovernorRegistered[governor]) revert GovernorAlreadyRegistered();

        // Query token() from the governor
        (bool tokenSuccess, bytes memory tokenData) = governor.staticcall(
            abi.encodeWithSignature("token()")
        );
        if (!tokenSuccess || tokenData.length < 32) {
            revert InvalidGovernorToken();
        }
        address token = abi.decode(tokenData, (address));
        if (token == address(0) || token.code.length == 0) {
            revert InvalidGovernorToken();
        }
        if (isTokenRegistered[token]) revert TokenAlreadyRegistered();

        // Query name() from the governor (optional fallback if not implemented)
        string memory daoName = "";
        (bool nameSuccess, bytes memory nameData) = governor.staticcall(
            abi.encodeWithSignature("name()")
        );
        if (nameSuccess && nameData.length > 0) {
            daoName = abi.decode(nameData, (string));
        }

        // Query timelock() from the governor (optional fallback if governor has no timelock)
        address timelock = address(0);
        (bool timelockSuccess, bytes memory timelockData) = governor.staticcall(
            abi.encodeWithSignature("timelock()")
        );
        if (timelockSuccess && timelockData.length >= 32) {
            timelock = abi.decode(timelockData, (address));
        }

        DAO memory newDao = DAO({
            governor: governor,
            token: token,
            timelock: timelock,
            registrant: registrant,
            name: daoName,
            timestamp: block.timestamp
        });

        isGovernorRegistered[governor] = true;
        isTokenRegistered[token] = true;
        daoByGovernor[governor] = newDao;
        daoByToken[token] = newDao;
        _daos.push(newDao);

        emit DAORegistered(governor, token, registrant);

        return newDao;
    }

    /**
     * @notice Get total number of registered DAOs
     */
    function getDAOCount() external view returns (uint256) {
        return _daos.length;
    }

    /**
     * @notice Paginated retrieval of registered DAOs
     * @param offset Starting index
     * @param limit Maximum number of records to return
     */
    function getDAOs(uint256 offset, uint256 limit) external view returns (DAO[] memory) {
        uint256 total = _daos.length;
        if (offset >= total || limit == 0) {
            return new DAO[](0);
        }

        uint256 end;
        if (limit > total - offset) {
            end = total;
        } else {
            end = offset + limit;
        }

        uint256 size = end - offset;
        DAO[] memory result = new DAO[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = _daos[offset + i];
        }

        return result;
    }

    /**
     * @notice Retrieve DAO details by governor address
     */
    function getDAOByGovernor(address governor) external view returns (DAO memory) {
        if (!isGovernorRegistered[governor]) revert DAONotFound();
        return daoByGovernor[governor];
    }

    /**
     * @notice Retrieve DAO details by token address
     */
    function getDAOByToken(address token) external view returns (DAO memory) {
        if (!isTokenRegistered[token]) revert DAONotFound();
        return daoByToken[token];
    }
}
