
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const CONTRACT_ADDRESS =
  "0x703Bd7037314195A8714A5984be0CDb885da9f20";

const VERIFIER_ADDRESS =
  "0x7FbeE4f14FdF6Fb26A5DDa46EEf477B55EB2D4A0";

const RECORD_ID =
  "0x1f4497a1ad2f11b261e78c7e93521c885519a0f6ed7a5f11bcbb5b63c8a39d34";

async function main() {
  if (
    !process.env.DIDLAB_RPC_URL ||
    !process.env.DIDLAB_VERIFIER_PRIVATE_KEY
  ) {
    throw new Error(
      "Missing DIDLAB_RPC_URL or DIDLAB_VERIFIER_PRIVATE_KEY in .env."
    );
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
    process.env.DIDLAB_VERIFIER_PRIVATE_KEY,
    provider
  );

  const network = await provider.getNetwork();

  if (network.chainId !== 252501n) {
    throw new Error("Wrong network. Expected DIDLab chain ID 252501.");
  }

  if (wallet.address.toLowerCase() !== VERIFIER_ADDRESS.toLowerCase()) {
    throw new Error(
      "The private key does not belong to the expected Wallet B verifier."
    );
  }

  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    artifact.abi,
    wallet
  );

  const verifierRole = await contract.VERIFIER();
  const authorized = await contract.hasRole(
    verifierRole,
    wallet.address
  );

  if (!authorized) {
    throw new Error("Wallet B does not have the VERIFIER role.");
  }

  const existing = await contract.get(RECORD_ID);

  if (existing.submittedAt === 0n) {
    throw new Error("The record does not exist on this registry.");
  }

  if (existing.verifiedAt !== 0n) {
    throw new Error("This record has already been verified.");
  }

  if (
    existing.submitter.toLowerCase() === wallet.address.toLowerCase()
  ) {
    throw new Error("A submitter cannot verify their own record.");
  }

  console.log("Verifier wallet:", wallet.address);
  console.log("Registry:", CONTRACT_ADDRESS);
  console.log("Record ID:", RECORD_ID);
  console.log("Stored digest:", existing.digest);
  console.log("Stored CID:", existing.cid);

  console.log("\nSubmitting verification transaction...");

  const tx = await contract.verify(RECORD_ID);
  console.log("Transaction hash:", tx.hash);

  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("Verification transaction failed.");
  }

  const record = await contract.get(RECORD_ID);

  console.log("\n=== ARTIFACT VERIFIED ===");
  console.log("Record ID:", RECORD_ID);
  console.log("Transaction hash:", tx.hash);
  console.log("Block number:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed.toString());
  console.log("Verifier:", record.verifier);
  console.log("Verified at (Unix):", record.verifiedAt.toString());
}

main().catch((error) => {
  console.error(
    "\nVerification failed:",
    error.shortMessage || error.message
  );

  if (error.receipt) {
    console.error("Receipt status:", error.receipt.status);
    console.error("Transaction hash:", error.receipt.hash);
  }

  process.exitCode = 1;
});
