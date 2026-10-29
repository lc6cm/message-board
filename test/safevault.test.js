
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SafeVault — security tests", function () {
  let vault;
  let owner;
  let attacker;
  let user;

  beforeEach(async function () {
    [owner, attacker, user] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("SafeVault");
    vault = await Factory.deploy();
    await vault.waitForDeployment();
  });

  it("blocks unauthorized ownership changes", async function () {
    await expect(
      vault.connect(attacker).setOwner(attacker.address)
    ).to.be.revertedWithCustomError(vault, "NotOwner");

    expect(await vault.owner()).to.equal(owner.address);
  });

  it("rejects the zero address as the new owner", async function () {
    await expect(
      vault.setOwner(ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(vault, "ZeroAddress");
  });

  it("blocks unauthorized attempts to sweep funds", async function () {
    await vault.connect(user).deposit({
      value: ethers.parseEther("5")
    });

    await expect(
      vault.connect(attacker).sweep(attacker.address)
    ).to.be.revertedWithCustomError(vault, "NotOwner");
  });

  it("allows a user to make a normal withdrawal", async function () {
    await vault.connect(user).deposit({
      value: ethers.parseEther("2")
    });

    await expect(
      vault.connect(user).withdraw(ethers.parseEther("1"))
    ).to.not.be.reverted;

    expect(await vault.balances(user.address)).to.equal(
      ethers.parseEther("1")
    );
  });

  it("blocks reentrant withdrawals", async function () {
    const Reenter = await ethers.getContractFactory("Reenterer");
    const bomb = await Reenter.deploy(await vault.getAddress());
    await bomb.waitForDeployment();

    // A user deposits funds into the vault.
    await vault.connect(user).deposit({
      value: ethers.parseEther("5")
    });

    // The attacker attempts to reenter during withdrawal.
    await expect(
      bomb.attack({ value: ethers.parseEther("1") })
    ).to.be.revertedWithCustomError(vault, "TransferFailed");

    // The failed attack must not take the user's funds.
    expect(await vault.balances(user.address)).to.equal(
      ethers.parseEther("5")
    );
  });

  it("blocks deposits and withdrawals while paused", async function () {
    await vault.connect(user).deposit({
      value: ethers.parseEther("1")
    });

    await vault.setPaused(true);

    await expect(
      vault.connect(user).deposit({
        value: ethers.parseEther("1")
      })
    ).to.be.revertedWithCustomError(vault, "ContractPaused");

    await expect(
      vault.connect(user).withdraw(ethers.parseEther("1"))
    ).to.be.revertedWithCustomError(vault, "ContractPaused");
  });
});
