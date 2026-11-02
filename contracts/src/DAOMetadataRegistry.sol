// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title DAOMetadataRegistry
 * @notice Standalone registry for DAO metadata (avatar/image URI, description)
 * @dev Stores imageUri on-chain and emits DAOMetadataUpdated events for the indexer/subgraph.
 *      Does not touch or modify existing Governor or Token contracts.
 */
contract DAOMetadataRegistry {
    struct Metadata {
        string imageUri;
        string description;
        address updater;
        uint256 updatedAt;
    }

    /// @notice DAO governor address => Metadata
    mapping(address => Metadata) private _metadata;

    /// @notice Emitted whenever a DAO's metadata is set or updated
    event DAOMetadataUpdated(
        address indexed dao,
        string imageUri,
        string description,
        address indexed updater
    );

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
        require(dao != address(0), "Invalid DAO address");

        _metadata[dao] = Metadata({
            imageUri: imageUri,
            description: description,
            updater: msg.sender,
            updatedAt: block.timestamp
        });

        emit DAOMetadataUpdated(dao, imageUri, description, msg.sender);
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
