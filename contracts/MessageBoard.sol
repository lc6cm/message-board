// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MessageBoard {
    string private latestMessage;
    address public lastPoster;
    uint256 public messageCount;

    event MessagePosted(
        address indexed poster,
        string message,
        uint256 totalMessages
    );

    function postMessage(string calldata message) external {
        require(bytes(message).length > 0, "Message cannot be empty");
        require(bytes(message).length <= 280, "Message too long");

        latestMessage = message;
        lastPoster = msg.sender;
        messageCount++;

        emit MessagePosted(msg.sender, message, messageCount);
    }

    function getLatestMessage() external view returns (string memory) {
        return latestMessage;
    }
}