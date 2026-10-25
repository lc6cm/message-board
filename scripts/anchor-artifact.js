
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const CONTRACT_ADDRESS =
  "0x703Bd7037314195A8714A5984be0CDb885da9f20";

const CID =
  "QmQLmPqHQMgLRdzYcR6ZYVrm3t2TUEkE2YGaRDRh7beUDu";

// SHA-256 of the verified encrypted ciphertext.
const DIGEST =
  "0xb7d4482482c9e6994b872cfe1dfe7008683558159d3f944939b75b9fb4039400";

// Non-personal identifier for this artifact/version.
const RECORD_ID = ethers.keccak256(
  ethers.toUtf8Bytes("message-board-artifact-v1")
);

async function main() {
  if (!process.env.DIDLAB_RPC_URL ||
      !process.env.DIDLAB_PRIVATE_KEY) {
    throw new Error("Missing DIDLab environment variables.");
  }

  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/AnchorRegistry.sol/AnchorRegistry.json"
  );

  const artifact = JSON.parse(
    fs.readFileSync(artifactPath, "utf8")
  );

  const provider = new ethers.JsonRpcProvider(
    process.env.DIDLAB_RPC_URL
  );

  const wallet = new ethers.Wallet(
    process.env.DIDLAB_PRIVATE_KEY,
    provider
  );

  const network = await provider.getNetwork();

  if (network.chainId !== 252501n) {
    throw new Error("Wrong network. Expected DIDLab chain ID 252501.");
  }

  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    artifact.abi,
    wallet
  );

  const submitterRole = await contract.SUBMITTER();
  const authorized = await contract.hasRole(
    submitterRole,
    wallet.address
  );

  if (!authorized) {
    throw new Error("Connected wallet does not have SUBMITTER role.");
  }

  if (!ethers.isHexString(DIGEST, 32)) {
    throw new Error("Digest must be exactly 32 bytes.");
  }

  console.log("Wallet:", wallet.address);
  console.log("Registry:", CONTRACT_ADDRESS);
  console.log("Record ID:", RECORD_ID);
  console.log("Digest:", DIGEST);
  console.log("CID:", CID);

  const existing = await contract.get(RECORD_ID);

  if (existing.submittedAt !== 0n) {
    throw new Error(
      "This record ID is already anchored. Do not submit it again."
    );
  }

  console.log("\nSubmitting anchor transaction...");

  const tx = await contract.anchor(RECORD_ID, DIGEST, CID);
  console.log("Transaction hash:", tx.hash);

  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("Anchor transaction failed.");
  }

  const record = await contract.get(RECORD_ID);

  console.log("\n=== ARTIFACT ANCHORED ===");
  console.log("Record ID:", RECORD_ID);
  console.log("Transaction hash:", tx.hash);
  console.log("Block number:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed.toString());
  console.log("Stored digest:", record.digest);
  console.log("Stored CID:", record.cid);
  console.log("Submitter:", record.submitter);
  console.log("Submitted at (Unix):", record.submittedAt.toString());
}

main().catch((error) => {
  console.error(
    "\nAnchoring failed:",
    error.shortMessage || error.message
  );

  if (error.receipt) {
    console.error("Receipt status:", error.receipt.status);
    console.error("Transaction hash:", error.receipt.hash);
  }

  process.exitCode = 1;
});
