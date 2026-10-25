
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { ethers } = require("ethers");

const SUBMITTER_ADDRESS =
  "0x07a04d2Eb63fE3B61FCE842D6DA6fC260B906e0a";

const VERIFIER_ADDRESS =
  "0x7FbeE4f14FdF6Fb26A5DDa46EEf477B55EB2D4A0";

const EXPECTED_CHAIN_ID = 252501n;

async function main() {
  if (
    !process.env.DIDLAB_RPC_URL ||
    !process.env.DIDLAB_PRIVATE_KEY
  ) {
    throw new Error(
      "Missing DIDLAB_RPC_URL or DIDLAB_PRIVATE_KEY in .env"
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

  const admin = new ethers.Wallet(
    process.env.DIDLAB_PRIVATE_KEY,
    provider
  );

  const network = await provider.getNetwork();

  console.log("Connected chain ID:", network.chainId.toString());
  console.log("Admin wallet:", admin.address);
  console.log("Submitter wallet:", SUBMITTER_ADDRESS);
  console.log("Verifier wallet:", VERIFIER_ADDRESS);

  if (network.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(
      "Wrong network. Expected DIDLab chain ID 252501."
    );
  }

  // Wallet A can be both ADMIN and SUBMITTER.
  // The VERIFIER must be a different wallet from the submitter.
  if (
    admin.address.toLowerCase() ===
    VERIFIER_ADDRESS.toLowerCase()
  ) {
    throw new Error(
      "Admin/submitter and verifier must be different wallets."
    );
  }

  console.log(
    "Admin balance:",
    ethers.formatEther(
      await provider.getBalance(admin.address)
    ),
    "native tokens"
  );

  console.log("\nDeploying AnchorRegistry...");

  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    admin
  );

  const contract = await factory.deploy();
  const deployTx = contract.deploymentTransaction();

  console.log("Deployment transaction:", deployTx.hash);

  const deployReceipt = await deployTx.wait();

  if (!deployReceipt || deployReceipt.status !== 1) {
    throw new Error("Contract deployment failed.");
  }

  const address = await contract.getAddress();

  console.log("Contract address:", address);
  console.log("Deployment block:", deployReceipt.blockNumber);
  console.log(
    "Deployment gas used:",
    deployReceipt.gasUsed.toString()
  );

  const submitterRole = await contract.SUBMITTER();
  const verifierRole = await contract.VERIFIER();
  const adminRole = await contract.ADMIN();

  console.log("\nGranting SUBMITTER to wallet A...");

  const submitterTx = await contract.grantRole(
    submitterRole,
    SUBMITTER_ADDRESS
  );

  console.log("SUBMITTER grant transaction:", submitterTx.hash);

  const submitterReceipt = await submitterTx.wait();

  if (!submitterReceipt || submitterReceipt.status !== 1) {
    throw new Error("SUBMITTER role grant failed.");
  }

  console.log("\nGranting VERIFIER to wallet B...");

  const verifierTx = await contract.grantRole(
    verifierRole,
    VERIFIER_ADDRESS
  );

  console.log("VERIFIER grant transaction:", verifierTx.hash);

  const verifierReceipt = await verifierTx.wait();

  if (!verifierReceipt || verifierReceipt.status !== 1) {
    throw new Error("VERIFIER role grant failed.");
  }

  console.log("\nChecking assigned roles...");

  const adminConfirmed = await contract.hasRole(
    adminRole,
    admin.address
  );

  const submitterConfirmed = await contract.hasRole(
    submitterRole,
    SUBMITTER_ADDRESS
  );

  const verifierConfirmed = await contract.hasRole(
    verifierRole,
    VERIFIER_ADDRESS
  );

  if (
    !adminConfirmed ||
    !submitterConfirmed ||
    !verifierConfirmed
  ) {
    throw new Error(
      "Role verification failed. Check the on-chain roles."
    );
  }

  const output = {
    address,
    abi: artifact.abi,
    chainId: EXPECTED_CHAIN_ID.toString()
  };

  const outputPath = path.join(
    __dirname,
    "../frontend/public/anchor-registry.json"
  );

  fs.writeFileSync(
    outputPath,
    JSON.stringify(output, null, 2)
  );

  console.log("\n=== DEPLOYMENT SUCCESSFUL ===");
  console.log("Registry address:", address);
  console.log("Admin confirmed:", adminConfirmed);
  console.log("Wallet A has SUBMITTER:", submitterConfirmed);
  console.log("Wallet B has VERIFIER:", verifierConfirmed);
  console.log("Deployment transaction:", deployTx.hash);
  console.log("Deployment block:", deployReceipt.blockNumber);
  console.log(
    "Deployment gas:",
    deployReceipt.gasUsed.toString()
  );
  console.log("SUBMITTER grant transaction:", submitterTx.hash);
  console.log("SUBMITTER grant block:", submitterReceipt.blockNumber);
  console.log(
    "SUBMITTER grant gas:",
    submitterReceipt.gasUsed.toString()
  );
  console.log("VERIFIER grant transaction:", verifierTx.hash);
  console.log("VERIFIER grant block:", verifierReceipt.blockNumber);
  console.log(
    "VERIFIER grant gas:",
    verifierReceipt.gasUsed.toString()
  );
  console.log("Saved registry ABI/address to:", outputPath);
}

main().catch((error) => {
  console.error(
    "\nDeployment failed:",
    error.shortMessage || error.message
  );

  if (error.receipt) {
    console.error(
      "Transaction receipt status:",
      error.receipt.status
    );
    console.error(
      "Transaction hash:",
      error.receipt.hash
    );
  }

  process.exitCode = 1;
});
