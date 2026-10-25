
require("dotenv").config();
const { ethers } = require("ethers");

const HASH =
  "0x8e368227343d027bcf0c88d8c49e10a42abca9e23f9725a8a24db902d901a8ce";

const WALLET_B =
  "0x7FbeE4f14FdF6Fb26A5DDa46EEf477B55EB2D4A0";

const CONTRACT =
  "0x703Bd7037314195A8714A5984be0CDb885da9f20";

const RECORD_ID =
  "0x1f4497a1ad2f11b261e78c7e93521c885519a0f6ed7a5f11bcbb5b63c8a39d34";

async function main() {
  if (!process.env.DIDLAB_RPC_URL ||
      !process.env.DIDLAB_VERIFIER_PRIVATE_KEY) {
    throw new Error("Missing RPC URL or Wallet B private key.");
  }

  const provider = new ethers.JsonRpcProvider(
    process.env.DIDLAB_RPC_URL
  );

  const wallet = new ethers.Wallet(
    process.env.DIDLAB_VERIFIER_PRIVATE_KEY,
    provider
  );

  if (wallet.address.toLowerCase() !== WALLET_B.toLowerCase()) {
    throw new Error("Wrong wallet. Expected Wallet B.");
  }

  const network = await provider.getNetwork();
  if (network.chainId !== 252501n) {
    throw new Error("Wrong network. Expected chain ID 252501.");
  }

  const oldTx = await provider.getTransaction(HASH);
  if (!oldTx) {
    throw new Error("Original transaction not found. Stop here.");
  }

  if (oldTx.blockNumber !== null) {
    throw new Error("Original transaction is already mined. Do not replace.");
  }

  if (oldTx.from.toLowerCase() !== WALLET_B.toLowerCase()) {
    throw new Error("Original transaction sender is not Wallet B.");
  }

  if (oldTx.to?.toLowerCase() !== CONTRACT.toLowerCase()) {
    throw new Error("Original transaction targets a different contract.");
  }

  const artifact = require(
    "../artifacts/contracts/AnchorRegistry.sol/AnchorRegistry.json"
  );

  const contract = new ethers.Contract(
    CONTRACT,
    artifact.abi,
    provider
  );

  const expectedData = contract.interface.encodeFunctionData(
    "verify",
    [RECORD_ID]
  );

  if (oldTx.data.toLowerCase() !== expectedData.toLowerCase()) {
    throw new Error("Original transaction is not the expected verify call.");
  }

  const receipt = await provider.getTransactionReceipt(HASH);
  if (receipt) {
    throw new Error("Original transaction has a receipt. Check its status.");
  }

  const record = await contract.get(RECORD_ID);
  if (record.verifiedAt !== 0n) {
    throw new Error("Record is already verified. Do not send a replacement.");
  }

  const latestNonce = await provider.getTransactionCount(
    wallet.address, "latest"
  );

  const pendingNonce = await provider.getTransactionCount(
    wallet.address, "pending"
  );

  if (latestNonce !== oldTx.nonce ||
      pendingNonce !== oldTx.nonce + 1) {
    throw new Error(
      `Nonce state changed (latest=${latestNonce}, pending=${pendingNonce}). Stop and inspect before replacing.`
    );
  }

  const oldGasPrice = oldTx.gasPrice;
  const newGasPrice = ethers.parseUnits("2", "gwei");

  if (newGasPrice <= oldGasPrice) {
    throw new Error("Replacement gas price must be higher.");
  }

  console.log("Original transaction:", HASH);
  console.log("Nonce:", oldTx.nonce);
  console.log("Old gas price (gwei):", ethers.formatUnits(oldGasPrice, "gwei"));
  console.log("Replacement gas price (gwei):", ethers.formatUnits(newGasPrice, "gwei"));
  console.log("Record is currently unverified.");
  console.log("\nSubmitting replacement transaction...");

  const replacement = await wallet.sendTransaction({
    to: oldTx.to,
    data: oldTx.data,
    value: oldTx.value,
    nonce: oldTx.nonce,
    gasLimit: oldTx.gasLimit,
    gasPrice: newGasPrice,
    chainId: network.chainId
  });

  console.log("Replacement hash:", replacement.hash);

  const minedReceipt = await replacement.wait(1, 120000);

  if (!minedReceipt) {
    console.log("Still pending after waiting. Do not submit another transaction.");
    return;
  }

  console.log("Receipt status:", minedReceipt.status === 1 ? "SUCCESS" : "FAILED");
  console.log("Block:", minedReceipt.blockNumber);
  console.log("Gas used:", minedReceipt.gasUsed.toString());

  const updated = await contract.get(RECORD_ID);
  console.log("Verifier:", updated.verifier);
  console.log("Verified at (Unix):", updated.verifiedAt.toString());
  console.log("Verified:", updated.verifiedAt !== 0n);
}

main().catch((error) => {
  console.error("\nReplacement stopped:", error.shortMessage || error.message);
  process.exitCode = 1;
});
