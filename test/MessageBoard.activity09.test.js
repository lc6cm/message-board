
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Activity 09 - MessageBoard AI Audit Verification", function () {

    async function deployBoard() {
        const MessageBoard = await ethers.getContractFactory("MessageBoard");
        const board = await MessageBoard.deploy();
        return board;
    }

    it("1. Allows another account to overwrite the latest message", async function () {
        const [owner, attacker] = await ethers.getSigners();
        const board = await deployBoard();

        await board.postMessage("Original message");
        await board.connect(attacker).postMessage("New message");

        expect(await board.getLatestMessage()).to.equal("New message");
        expect(await board.lastPoster()).to.equal(attacker.address);
    });

    it("2. Rejects empty messages", async function () {
        const board = await deployBoard();

        await expect(board.postMessage(""))
            .to.be.revertedWith("Message cannot be empty");
    });

    it("3. Accepts messages containing exactly 280 bytes", async function () {
        const board = await deployBoard();
        const message = "A".repeat(280);

        await board.postMessage(message);

        expect(await board.getLatestMessage()).to.equal(message);
    });

    it("4. Rejects messages exceeding 280 bytes", async function () {
        const board = await deployBoard();
        const message = "A".repeat(281);

        await expect(board.postMessage(message))
            .to.be.revertedWith("Message too long");
    });

    it("5. Emits the correct event after updating state", async function () {
        const [owner] = await ethers.getSigners();
        const board = await deployBoard();

        await expect(board.postMessage("Hello"))
            .to.emit(board, "MessagePosted")
            .withArgs(owner.address, "Hello", 1n);

        expect(await board.getLatestMessage()).to.equal("Hello");
        expect(await board.lastPoster()).to.equal(owner.address);
        expect(await board.messageCount()).to.equal(1n);
    });

});
