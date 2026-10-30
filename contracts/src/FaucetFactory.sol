// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DAOFaucet} from "./DAOFaucet.sol";

/**
 * @title FaucetFactory
 * @notice Factory for deploying DAOFaucet contracts on liteforge.
 */
contract FaucetFactory {
    struct FaucetInfo {
        address faucet;
        address token;
        address admin;
        DAOFaucet.FaucetMode mode;
        uint256 createdAt;
    }

    /// @notice List of all faucets created
    FaucetInfo[] private _faucets;

    /// @notice Tracks whether a faucet was deployed by this factory
    mapping(address => bool) public isCreatedFaucet;

    /// @notice Token address => primary faucet
    mapping(address => address) public faucetByToken;

    /// @notice Creator address => faucets created by creator
    mapping(address => address[]) private _faucetsByCreator;

    event FaucetCreated(
        address indexed faucet,
        address indexed token,
        address indexed admin,
        DAOFaucet.FaucetMode mode
    );

    error InvalidToken();
    error InvalidClaimAmount();

    /**
     * @notice Deploy a new faucet for a token
     * @param token Address of the token to distribute
     * @param claimAmount Amount of tokens per claim
     * @param cooldownPeriod Seconds required between claims
     * @param mode FaucetMode (MINT or PRE_FUNDED)
     * @return faucet Address of the deployed faucet
     */
    function createFaucet(
        address token,
        uint256 claimAmount,
        uint256 cooldownPeriod,
        DAOFaucet.FaucetMode mode
    ) external returns (address faucet) {
        if (token == address(0) || token.code.length == 0) revert InvalidToken();
        if (claimAmount == 0) revert InvalidClaimAmount();

        DAOFaucet newFaucet = new DAOFaucet(
            token,
            msg.sender, // creator is admin
            claimAmount,
            cooldownPeriod,
            mode
        );
        faucet = address(newFaucet);

        FaucetInfo memory info = FaucetInfo({
            faucet: faucet,
            token: token,
            admin: msg.sender,
            mode: mode,
            createdAt: block.timestamp
        });

        _faucets.push(info);
        isCreatedFaucet[faucet] = true;
        if (faucetByToken[token] == address(0)) {
            faucetByToken[token] = faucet;
        }
        _faucetsByCreator[msg.sender].push(faucet);

        emit FaucetCreated(faucet, token, msg.sender, mode);
    }

    /**
     * @notice Total number of faucets created
     */
    function getFaucetCount() external view returns (uint256) {
        return _faucets.length;
    }

    /**
     * @notice Paginated retrieval of faucets created
     */
    function getFaucets(uint256 offset, uint256 limit)
        external
        view
        returns (FaucetInfo[] memory)
    {
        uint256 total = _faucets.length;
        if (offset >= total || limit == 0) {
            return new FaucetInfo[](0);
        }

        uint256 end;
        if (limit > total - offset) {
            end = total;
        } else {
            end = offset + limit;
        }

        uint256 size = end - offset;
        FaucetInfo[] memory result = new FaucetInfo[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = _faucets[offset + i];
        }

        return result;
    }

    /**
     * @notice Retrieve faucets created by a specific creator
     */
    function getFaucetsByCreator(address creator) external view returns (address[] memory) {
        return _faucetsByCreator[creator];
    }
}
