const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AnchorRegistry", function () {
    let registry;
    let admin;
    let submitter;
    let verifier;
    let outsider;

    const ADMIN = ethers.keccak256(ethers.toUtf8Bytes("ADMIN"));
    const SUBMITTER = ethers.keccak256(ethers.toUtf8Bytes("SUBMITTER"));
    const VERIFIER = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER"));

    const recordId = ethers.keccak256(
        ethers.toUtf8Bytes("test-record-001")
    );

    const digest = ethers.sha256(
        ethers.toUtf8Bytes("encrypted test artifact")
    );

    const cid = "QmTestArtifactCID";

    beforeEach(async function () {
        [admin, submitter, verifier, outsider] =
            await ethers.getSigners();

        const Factory = await ethers.getContractFactory("AnchorRegistry");
        registry = await Factory.deploy();
        await registry.waitForDeployment();

        await registry.grantRole(SUBMITTER, submitter.address);
        await registry.grantRole(VERIFIER, verifier.address);
    });

    it("1. Gives ADMIN to the deployer only", async function () {
        expect(await registry.hasRole(ADMIN, admin.address)).to.equal(true);
        expect(await registry.hasRole(SUBMITTER, admin.address)).to.equal(false);
        expect(await registry.hasRole(VERIFIER, admin.address)).to.equal(false);
    });

    it("2. Allows ADMIN to grant and revoke roles", async function () {
        await registry.grantRole(SUBMITTER, outsider.address);
        expect(await registry.hasRole(SUBMITTER, outsider.address)).to.equal(true);

        await registry.revokeRole(SUBMITTER, outsider.address);
        expect(await registry.hasRole(SUBMITTER, outsider.address)).to.equal(false);
    });

    it("3. Rejects role changes by non-admins", async function () {
        await expect(
            registry.connect(outsider).grantRole(SUBMITTER, outsider.address)
        ).to.be.revertedWithCustomError(registry, "NotAuthorized");

        await expect(
            registry.connect(outsider).revokeRole(SUBMITTER, submitter.address)
        ).to.be.revertedWithCustomError(registry, "NotAuthorized");
    });

    it("4. Rejects anchoring by an account without SUBMITTER", async function () {
        await expect(
            registry.connect(outsider).anchor(recordId, digest, cid)
        ).to.be.revertedWithCustomError(registry, "NotAuthorized");
    });

    it("5. Rejects an empty digest", async function () {
        await expect(
            registry.connect(submitter).anchor(
                recordId,
                ethers.ZeroHash,
                cid
            )
        ).to.be.revertedWithCustomError(registry, "EmptyDigest");
    });

    it("6. Stores a record submitted by an authorized wallet", async function () {
        await registry.connect(submitter).anchor(recordId, digest, cid);

        const record = await registry.get(recordId);

        expect(record.digest).to.equal(digest);
        expect(record.cid).to.equal(cid);
        expect(record.submitter).to.equal(submitter.address);
        expect(record.submittedAt).to.be.greaterThan(0);
        expect(record.verifier).to.equal(ethers.ZeroAddress);
        expect(record.verifiedAt).to.equal(0);
    });

    it("7. Rejects duplicate record IDs", async function () {
        await registry.connect(submitter).anchor(recordId, digest, cid);

        await expect(
            registry.connect(submitter).anchor(recordId, digest, cid)
        ).to.be.revertedWithCustomError(registry, "AlreadyAnchored");
    });

    it("8. Rejects verification by an account without VERIFIER", async function () {
        await registry.connect(submitter).anchor(recordId, digest, cid);

        await expect(
            registry.connect(outsider).verify(recordId)
        ).to.be.revertedWithCustomError(registry, "NotAuthorized");
    });

    it("9. Rejects verification of unknown records", async function () {
        await expect(
            registry.connect(verifier).verify(ethers.ZeroHash)
        ).to.be.revertedWithCustomError(registry, "UnknownRecord");
    });

    it("10. Prevents self-verification and repeated verification", async function () {
        await registry.grantRole(VERIFIER, submitter.address);

        await registry.connect(submitter).anchor(recordId, digest, cid);

        await expect(
            registry.connect(submitter).verify(recordId)
        ).to.be.revertedWithCustomError(registry, "SelfVerification");

        await registry.connect(verifier).verify(recordId);

        await expect(
            registry.connect(verifier).verify(recordId)
        ).to.be.revertedWithCustomError(registry, "AlreadyVerified");

        const record = await registry.get(recordId);
        expect(record.verifier).to.equal(verifier.address);
        expect(record.verifiedAt).to.be.greaterThan(0);
    });
});