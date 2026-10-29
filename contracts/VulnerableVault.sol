
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Deliberately vulnerable teaching contract. Do not deploy.
contract VulnerableVault {
    address public owner;
    mapping(address => uint256) public balances;
    bool public paused;

    constructor() {
        owner = msg.sender;
    }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

        function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "insufficient");
        (bool ok, ) = msg.sender.call{value: amount}("");
        unchecked {
            balances[msg.sender] -= amount;
        }
    }

    function setOwner(address newOwner) external {
        owner = newOwner;
    }

    function sweep(address to) external {
        require(msg.sender == owner, "not owner");
        (bool ok, ) = to.call{value: address(this).balance}("");
    }

    function setPaused(bool v) external {
        require(msg.sender == owner, "not owner");
        paused = v;
    }
}
