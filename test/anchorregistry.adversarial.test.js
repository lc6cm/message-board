
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AnchorRegistry — adversarial security tests", function () {
    let registry;
    let admin;
    let submitter;
    let verifier;
    let outsider;

    const ADMIN = ethers.keccak256(ethers.toUtf8Bytes("ADMIN"));
    const SUBMITTER = ethers.keccak256(ethers.toUtf8Bytes("SUBMITTER"));
    const VERIFIER = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER"));

    const recordId = ethers.keccak256(
        ethers.toUtf8Bytes("adversarial-record-001")
    );

    const digest = ethers.sha256(
        ethers.toUtf8Bytes("test artifact")
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

    // ACCESS CONTROL TESTS

    it("rejects unauthorized role grants", async function () {
        await expect(
            registry.connect(outsider).grantRole(SUBMITTER, outsider.address)
        ).to.be.revertedWithCustomError(registry, "NotAuthorized");
    });

    it("rejects unauthorized role revocations", async function () {
        await expect(
            registry.connect(outsider).revokeRole(SUBMITTER, submitter.address)
        ).to.be.revertedWithCustomError(registry, "NotAuthorized");
    });

    it("rejects unauthorized record creation", async function () {
        await expect(
            registry.connect(outsider).anchor(recordId, digest, cid)
        ).to.be.revertedWithCustomError(registry, "NotAuthorized");
    });

    it("rejects unauthorized record verification", async function () {
        await registry.connect(submitter).anchor(recordId, digest, cid);

        await expect(
            registry.connect(outsider).verify(recordId)
        ).to.be.revertedWithCustomError(registry, "NotAuthorized");
    });

    // HOSTILE INPUT TESTS

    it("rejects an empty digest", async function () {
        await expect(
            registry.connect(submitter).anchor(
                recordId,
                ethers.ZeroHash,
                cid
            )
        ).to.be.revertedWithCustomError(registry, "EmptyDigest");
    });

    it("accepts a zero record ID (input validation finding)", async function () {
        await registry.connect(submitter).anchor(
            ethers.ZeroHash,
            digest,
            cid
        );

        const record = await registry.get(ethers.ZeroHash);
        expect(record.digest).to.equal(digest);
    });

    it("accepts an empty CID (input validation finding)", async function () {
        await registry.connect(submitter).anchor(
            recordId,
            digest,
            ""
        );

        const record = await registry.get(recordId);
        expect(record.cid).to.equal("");
    });

    it("accepts a long CID (input validation finding)", async function () {
        const longCid = "A".repeat(1024);

        await registry.connect(submitter).anchor(
            recordId,
            digest,
            longCid
        );

        const record = await registry.get(recordId);
        expect(record.cid).to.equal(longCid);
    });

    it("allows granting a role to the zero address", async function () {
        await registry.grantRole(SUBMITTER, ethers.ZeroAddress);

        expect(
            await registry.hasRole(SUBMITTER, ethers.ZeroAddress)
        ).to.equal(true);
    });

    it("allows an arbitrary role identifier to be granted", async function () {
        const unknownRole = ethers.keccak256(
            ethers.toUtf8Bytes("UNKNOWN_ROLE")
        );

        await registry.grantRole(unknownRole, outsider.address);

        expect(
            await registry.hasRole(unknownRole, outsider.address)
        ).to.equal(true);
    });

    // ADMINISTRATIVE LOCKOUT TEST

    it("allows the only admin to revoke its own ADMIN role", async function () {
        await registry.revokeRole(ADMIN, admin.address);

        expect(
            await registry.hasRole(ADMIN, admin.address)
        ).to.equal(false);

        await expect(
            registry.grantRole(ADMIN, outsider.address)
        ).to.be.revertedWithCustomError(registry, "NotAuthorized");
    });

    // FUNCTION ORDERING TESTS

    it("rejects verification before a record exists", async function () {
        await expect(
            registry.connect(verifier).verify(recordId)
        ).to.be.revertedWithCustomError(registry, "UnknownRecord");
    });

    it("rejects verification by the original submitter", async function () {
        await registry.grantRole(VERIFIER, submitter.address);
        await registry.connect(submitter).anchor(recordId, digest, cid);

        await expect(
            registry.connect(submitter).verify(recordId)
        ).to.be.revertedWithCustomError(registry, "SelfVerification");
    });

    it("rejects verification of an already verified record", async function () {
        await registry.connect(submitter).anchor(recordId, digest, cid);
        await registry.connect(verifier).verify(recordId);

        await expect(
            registry.connect(verifier).verify(recordId)
        ).to.be.revertedWithCustomError(registry, "AlreadyVerified");
    });
});
