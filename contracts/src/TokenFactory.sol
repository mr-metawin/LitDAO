// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DAOToken} from "./DAOToken.sol";

/**
 * @title TokenFactory
 * @notice Factory for deploying standard ERC20Votes governance tokens on liteforge.
 */
contract TokenFactory {
    struct TokenInfo {
        address tokenAddress;
        address creator;
        string name;
        string symbol;
        uint256 initialSupply;
        uint256 createdAt;
    }

    /// @notice List of all tokens deployed by this factory
    TokenInfo[] private _tokens;

    /// @notice Tracks whether a token address was deployed by this factory
    mapping(address => bool) public isCreatedToken;

    /// @notice Creator address => tokens deployed by creator
    mapping(address => address[]) private _tokensByCreator;

    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 initialSupply
    );

    /**
     * @notice Deploy a new governance token
     * @param name Name of the token (e.g. "LitDAO Token")
     * @param symbol Symbol of the token (e.g. "LTK")
     * @param initialSupply Amount of tokens minted to initialOwner (in wei)
     * @param initialOwner Initial owner who receives supply and admin/minter roles
     * @return token Address of the newly deployed token
     */
    function createToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address initialOwner
    ) external returns (address token) {
        address recipient = initialOwner == address(0) ? msg.sender : initialOwner;

        DAOToken newToken = new DAOToken(name, symbol, initialSupply, recipient);
        token = address(newToken);

        TokenInfo memory info = TokenInfo({
            tokenAddress: token,
            creator: msg.sender,
            name: name,
            symbol: symbol,
            initialSupply: initialSupply,
            createdAt: block.timestamp
        });

        _tokens.push(info);
        isCreatedToken[token] = true;
        _tokensByCreator[msg.sender].push(token);

        emit TokenCreated(token, msg.sender, name, symbol, initialSupply);
    }

    /**
     * @notice Total number of tokens created
     */
    function getTokenCount() external view returns (uint256) {
        return _tokens.length;
    }

    /**
     * @notice Paginated retrieval of tokens created
     * @param offset Starting index
     * @param limit Maximum number of records to return
     */
    function getTokens(uint256 offset, uint256 limit) external view returns (TokenInfo[] memory) {
        uint256 total = _tokens.length;
        if (offset >= total || limit == 0) {
            return new TokenInfo[](0);
        }

        uint256 end;
        if (limit > total - offset) {
            end = total;
        } else {
            end = offset + limit;
        }

        uint256 size = end - offset;
        TokenInfo[] memory result = new TokenInfo[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = _tokens[offset + i];
        }

        return result;
    }

    /**
     * @notice Get all token addresses created by a specific creator
     */
    function getTokensByCreator(address creator) external view returns (address[] memory) {
        return _tokensByCreator[creator];
    }
}
