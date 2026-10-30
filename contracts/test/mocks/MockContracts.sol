// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    address public owner;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        owner = msg.sender;
        _mint(msg.sender, 1_000_000 ether);
    }

    function setOwner(address newOwner) external {
        owner = newOwner;
    }
}

contract MockGovernor {
    address private immutable _token;
    address private immutable _timelock;
    string private _name;

    constructor(address token_, address timelock_, string memory name_) {
        _token = token_;
        _timelock = timelock_;
        _name = name_;
    }

    function token() external view returns (address) {
        return _token;
    }

    function timelock() external view returns (address) {
        return _timelock;
    }

    function name() external view returns (string memory) {
        return _name;
    }
}

contract MockGovernorRevertingToken {
    function token() external pure returns (address) {
        revert("token() failed");
    }

    function name() external pure returns (string memory) {
        return "Reverting Governor";
    }
}

contract MockGovernorNonContractToken {
    address public dummyEOA;

    constructor(address eoa) {
        dummyEOA = eoa;
    }

    function token() external view returns (address) {
        return dummyEOA;
    }

    function name() external pure returns (string memory) {
        return "Non Contract Token Governor";
    }
}
