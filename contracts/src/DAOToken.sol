// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title DAOToken
 * @notice ERC20 token with voting checkpoints (ERC20Votes), permit (EIP-2612),
 *         and role-based minting (AccessControl).
 * @dev Uses a timestamp-based clock (EIP-6372) for accurate time-based governance on liteforge.
 */
contract DAOToken is ERC20, ERC20Permit, ERC20Votes, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    event Minted(address indexed to, uint256 amount);

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address initialOwner
    ) ERC20(name, symbol) ERC20Permit(name) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(MINTER_ROLE, initialOwner);

        if (initialSupply > 0 && initialOwner != address(0)) {
            _mint(initialOwner, initialSupply);
            _delegate(initialOwner, initialOwner);
        }
    }

    /**
     * @notice Mint new tokens (restricted to MINTER_ROLE)
     * @param to Recipient address
     * @param amount Token amount in wei
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
        emit Minted(to, amount);
    }

    /**
     * @notice Timestamp-based clock (EIP-6372)
     */
    function clock() public view virtual override returns (uint48) {
        return uint48(block.timestamp);
    }

    /**
     * @notice Machine-readable description of clock mode (EIP-6372)
     */
    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public view virtual override returns (string memory) {
        return "mode=timestamp";
    }

    // Required overrides for ERC20 and ERC20Votes
    function _update(address from, address to, uint256 value)
        internal
        virtual
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        virtual
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
