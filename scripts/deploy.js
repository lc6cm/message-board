
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const solc = require("solc");
const { ethers } = require("ethers");

async function main() {
  if (!process.env.DIDLAB_RPC_URL || !process.env.DIDLAB_PRIVATE_KEY) {
    throw new Error("Missing DIDLAB_RPC_URL or DIDLAB_PRIVATE_KEY in .env");
  }

  const contractPath = path.join(__dirname, "../contracts/MessageBoard.sol");
  const source = fs.readFileSync(contractPath, "utf8");

  const input = {
    language: "Solidity",
    sources: {
      "MessageBoard.sol": { content: source }
    },
    settings: {
      // Use an EVM version compatible with chains without PUSH0 support.
      evmVersion: "paris",
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"]
        }
      }
    }
  };

  console.log("Compiling for the Paris EVM version...");

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    for (const error of output.errors) {
      console.log(error.formattedMessage);
    }

    if (output.errors.some((error) => error.severity === "error")) {
      throw new Error("Contract compilation failed.");
    }
  }

  const compiled = output.contracts["MessageBoard.sol"]["MessageBoard"];
  const abi = compiled.abi;
  const bytecode = "0x" + compiled.evm.bytecode.object;

  const provider = new ethers.JsonRpcProvider(process.env.DIDLAB_RPC_URL);
  const wallet = new ethers.Wallet(process.env.DIDLAB_PRIVATE_KEY, provider);

  const network = await provider.getNetwork();

  console.log("Connected chain ID:", network.chainId.toString());
  console.log("Wallet address:", wallet.address);

  if (network.chainId !== 252501n) {
    throw new Error("Wrong network. Expected DIDLab chain ID 252501.");
  }

  console.log(
    "Wallet balance:",
    ethers.formatEther(await provider.getBalance(wallet.address)),
    "native tokens"
  );

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const deployTransaction = await factory.getDeployTransaction();

  console.log("Deployment bytecode size:", (bytecode.length - 2) / 2, "bytes");
  console.log("Estimating deployment gas...");

  const gasEstimate = await provider.estimateGas({
    ...deployTransaction,
    from: wallet.address
  });

  console.log("Estimated gas:", gasEstimate.toString());
  console.log("Sending deployment transaction...");

  const contract = await factory.deploy({
    gasLimit: gasEstimate * 120n / 100n
  });

  const tx = contract.deploymentTransaction();
  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("Deployment transaction reverted.");
  }

  const address = await contract.getAddress();

  console.log("Deployment confirmed!");
  console.log("Contract address:", address);
  console.log("Block number:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed.toString());

  const artifact = {
    address,
    abi,
    chainId: "252501"
  };

  const artifactPath = path.join(
    __dirname,
    "../frontend/public/contract.json"
  );

  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  console.log("Saved frontend/public/contract.json");
}

main().catch((error) => {
  console.error("\nDeployment failed:", error.shortMessage || error.message);
  console.error("Code:", error.code || "unknown");
  console.error("Reason:", error.reason || "not provided");
  console.error("Data:", error.data || "not provided");

  if (error.info) {
    console.error("RPC info:", JSON.stringify(error.info, null, 2));
  }

  if (error.receipt) {
    console.error("Receipt status:", error.receipt.status);
    console.error("Receipt hash:", error.receipt.hash);
  }

  process.exitCode = 1;
});
