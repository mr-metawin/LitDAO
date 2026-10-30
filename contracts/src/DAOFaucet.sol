// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {DAOToken} from "./DAOToken.sol";

/**
 * @title DAOFaucet
 * @notice Distributes test governance tokens to users with cooldown enforcement.
 * @dev Supports both MINT mode (mints new tokens if authorized) and PRE_FUNDED mode (transfers reserve).
 */
contract DAOFaucet {
    using SafeERC20 for IERC20;

    enum FaucetMode {
        MINT,
        PRE_FUNDED
    }

    address public immutable token;
    address public admin;

    uint256 public claimAmount;
    uint256 public cooldownPeriod;
    bool public isPaused;
    FaucetMode public mode;

    /// @notice Tracks timestamp of each address's most recent claim
    mapping(address => uint256) public lastClaimAt;

    /// @notice Tracks cumulative tokens claimed by each address
    mapping(address => uint256) public totalClaimedBy;

    /// @notice Cumulative tokens distributed by this faucet
    uint256 public totalClaimed;

    // Events
    event Claimed(address indexed user, uint256 amount, FaucetMode mode);
    event ClaimAmountUpdated(uint256 newAmount);
    event CooldownPeriodUpdated(uint256 newCooldown);
    event FaucetModeUpdated(FaucetMode newMode);
    event PauseToggled(bool isPaused);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event TokensWithdrawn(address indexed recipient, uint256 amount);

    // Custom errors
    error NotAdmin();
    error FaucetPaused();
    error CooldownNotElapsed(uint256 timeRemaining);
    error InsufficientFaucetBalance();
    error InvalidClaimAmount();
    error InvalidRecipient();
    error InvalidAdminAddress();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(
        address tokenAddress,
        address initialAdmin,
        uint256 initialClaimAmount,
        uint256 initialCooldownPeriod,
        FaucetMode initialMode
    ) {
        if (tokenAddress == address(0)) revert InvalidRecipient();
        if (initialAdmin == address(0)) revert InvalidAdminAddress();
        if (initialClaimAmount == 0) revert InvalidClaimAmount();

        token = tokenAddress;
        admin = initialAdmin;
        claimAmount = initialClaimAmount;
        cooldownPeriod = initialCooldownPeriod;
        mode = initialMode;
    }

    /**
     * @notice Claim tokens from the faucet
     */
    function claim() external {
        if (isPaused) revert FaucetPaused();

        uint256 nextEligible = lastClaimAt[msg.sender] + cooldownPeriod;
        if (block.timestamp < nextEligible) {
            revert CooldownNotElapsed(nextEligible - block.timestamp);
        }

        lastClaimAt[msg.sender] = block.timestamp;
        totalClaimedBy[msg.sender] += claimAmount;
        totalClaimed += claimAmount;

        if (mode == FaucetMode.MINT) {
            // Mint mode: requires faucet to hold MINTER_ROLE on DAOToken
            DAOToken(token).mint(msg.sender, claimAmount);
        } else {
            // Pre-funded mode: transfers tokens from faucet's existing balance
            uint256 faucetBal = IERC20(token).balanceOf(address(this));
            if (faucetBal < claimAmount) {
                revert InsufficientFaucetBalance();
            }
            IERC20(token).safeTransfer(msg.sender, claimAmount);
        }

        emit Claimed(msg.sender, claimAmount, mode);
    }

    /**
     * @notice Check whether a user is currently eligible to claim
     * @param user Address to check
     * @return eligible True if user can claim immediately
     * @return timeRemaining Seconds remaining if on cooldown, or 0
     */
    function canClaim(address user) external view returns (bool eligible, uint256 timeRemaining) {
        if (isPaused) {
            return (false, 0);
        }
        uint256 nextEligible = lastClaimAt[user] + cooldownPeriod;
        if (block.timestamp >= nextEligible) {
            return (true, 0);
        } else {
            return (false, nextEligible - block.timestamp);
        }
    }

    /**
     * @notice Get current token balance held by the faucet
     */
    function getFaucetBalance() external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // -------------------------------------------------------------------------
    // Admin Controls
    // -------------------------------------------------------------------------

    function setClaimAmount(uint256 newAmount) external onlyAdmin {
        if (newAmount == 0) revert InvalidClaimAmount();
        claimAmount = newAmount;
        emit ClaimAmountUpdated(newAmount);
    }

    function setCooldownPeriod(uint256 newCooldown) external onlyAdmin {
        cooldownPeriod = newCooldown;
        emit CooldownPeriodUpdated(newCooldown);
    }

    function setMode(FaucetMode newMode) external onlyAdmin {
        mode = newMode;
        emit FaucetModeUpdated(newMode);
    }

    function setPaused(bool paused) external onlyAdmin {
        isPaused = paused;
        emit PauseToggled(paused);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAdminAddress();
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    /**
     * @notice Withdraw tokens held by the faucet (useful for pre-funded mode recovery)
     */
    function withdrawTokens(address recipient, uint256 amount) external onlyAdmin {
        if (recipient == address(0)) revert InvalidRecipient();
        IERC20(token).safeTransfer(recipient, amount);
        emit TokensWithdrawn(recipient, amount);
    }
}
