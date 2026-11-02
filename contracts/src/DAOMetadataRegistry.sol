// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDAORegistry {
    struct DAO {
        address governor;
        address token;
        address timelock;
        address registrant;
        string name;
        uint256 timestamp;
    }
    function getDAOByGovernor(address governor) external view returns (DAO memory);
    function isGovernorRegistered(address governor) external view returns (bool);
}

/**
 * @title DAOMetadataRegistry
 * @notice Secured registry for DAO metadata (avatar/image URI, description)
 * @dev Enforces access control: only the DAO registrant (creator), the Governor/Timelock
 *      itself via proposals, or a designated DAO admin can set metadata.
 */
contract DAOMetadataRegistry {
    struct Metadata {
        string imageUri;
        string description;
        address updater;
        uint256 updatedAt;
    }

    IDAORegistry public immutable daoRegistry;

    /// @notice Custom admin override per DAO (defaults to registrant)
    mapping(address => address) public daoAdmin;

    /// @notice DAO governor address => Metadata
    mapping(address => Metadata) private _metadata;

    /// @notice Emitted whenever a DAO's metadata is set or updated
    event DAOMetadataUpdated(
        address indexed dao,
        string imageUri,
        string description,
        address indexed updater
    );

    event DAOAdminTransferred(
        address indexed dao,
        address indexed oldAdmin,
        address indexed newAdmin
    );

    error NotAuthorized();
    error InvalidDAOAddress();

    constructor(address registryAddress) {
        daoRegistry = IDAORegistry(registryAddress);
    }

    /**
     * @notice Check whether an account is authorized to update a DAO's metadata
     * @param dao Governor address of the DAO
     * @param account Address attempting the update
     */
    function isAuthorized(address dao, address account) public view returns (bool) {
        if (account == address(0) || dao == address(0)) return false;

        // 1. Check custom admin override
        address customAdmin = daoAdmin[dao];
        if (customAdmin != address(0) && account == customAdmin) {
            return true;
        }

        // 2. The DAO contracts themselves (governor or timelock execution)
        if (account == dao) return true;

        // 3. Check DAORegistry for registrant, governor, or timelock
        if (address(daoRegistry) != address(0)) {
            try daoRegistry.getDAOByGovernor(dao) returns (IDAORegistry.DAO memory daoInfo) {
                if (account == daoInfo.registrant) return true;
                if (account == daoInfo.governor) return true;
                if (account == daoInfo.timelock) return true;
                // DAO is registered in DAORegistry but account is not authorized
                return false;
            } catch {
                // If lookup reverts or not yet registered, fall through
            }
        }

        // 4. If not yet in registry and no metadata set, allow creator/first caller
        if (customAdmin == address(0) && _metadata[dao].updater == address(0)) {
            return true;
        }

        return false;

    }

    /**
     * @notice Set or update DAO image URI and description
     * @param dao Governor address of the DAO
     * @param imageUri IPFS URI (e.g. ipfs://bafy...) or HTTP URL
     * @param description Brief description or mission of the DAO
     */
    function setDAOMetadata(
        address dao,
        string calldata imageUri,
        string calldata description
    ) external {
        if (dao == address(0)) revert InvalidDAOAddress();
        if (!isAuthorized(dao, msg.sender)) revert NotAuthorized();

        // If custom admin is not yet set, record current authorized updater
        if (daoAdmin[dao] == address(0)) {
            daoAdmin[dao] = msg.sender;
        }

        _metadata[dao] = Metadata({
            imageUri: imageUri,
            description: description,
            updater: msg.sender,
            updatedAt: block.timestamp
        });

        emit DAOMetadataUpdated(dao, imageUri, description, msg.sender);
    }

    /**
     * @notice Transfer DAO metadata admin rights to another address
     */
    function transferDAOAdmin(address dao, address newAdmin) external {
        if (dao == address(0)) revert InvalidDAOAddress();
        if (!isAuthorized(dao, msg.sender)) revert NotAuthorized();

        address oldAdmin = daoAdmin[dao];
        daoAdmin[dao] = newAdmin;

        emit DAOAdminTransferred(dao, oldAdmin, newAdmin);
    }

    /**
     * @notice Retrieve image URI for a DAO
     */
    function getDAOImageUri(address dao) external view returns (string memory) {
        return _metadata[dao].imageUri;
    }

    /**
     * @notice Retrieve full metadata for a DAO
     */
    function getDAOMetadata(address dao) external view returns (Metadata memory) {
        return _metadata[dao];
    }
}
