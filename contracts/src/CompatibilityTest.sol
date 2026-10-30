// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CompatibilityTest
 * @notice Tests EVM Cancun opcode support (such as MCOPY) and block timestamps on liteforge.
 */
contract CompatibilityTest {
    uint256 public deployTimestamp;

    event Checked(bytes data, uint256 timestamp);

    constructor() {
        deployTimestamp = block.timestamp;
    }

    function testMcopy(bytes memory input) external returns (bytes memory output) {
        output = new bytes(input.length);
        assembly {
            // MCOPY(dest, src, size) - Cancun opcode 0x5E
            mcopy(add(output, 0x20), add(input, 0x20), mload(input))
        }
        emit Checked(output, block.timestamp);
    }
}
