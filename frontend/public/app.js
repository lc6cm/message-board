
import { ethers } from "./ethers.min.js";

const EXPECTED_CHAIN_ID = 252501n;
const EXPECTED_CHAIN_HEX = "0x3da55";
const RPC_URL = "https://eth.didlab.org";

const connectButton = document.getElementById("connectButton");
const refreshButton = document.getElementById("refreshButton");
const simulateButton = document.getElementById("simulateButton");
const postButton = document.getElementById("postButton");

const walletLabel = document.getElementById("wallet");
const networkLabel = document.getElementById("network");
const latestMessageLabel = document.getElementById("latestMessage");
const lastPosterLabel = document.getElementById("lastPoster");
const messageCountLabel = document.getElementById("messageCount");
const messageInput = document.getElementById("messageInput");
const characterCount = document.getElementById("characterCount");
const statusLabel = document.getElementById("status");
const activityList = document.getElementById("activity");

let artifact;
let readProvider;
let readContract;
let walletProvider;
let signer;
let writeContract;
let eventListenerStarted = false;

const seenEvents = new Set();

function setStatus(message) {
  statusLabel.textContent = message;
}

function formatError(error) {
  return (
    error?.shortMessage ||
    error?.reason ||
    error?.info?.error?.message ||
    error?.message ||
    String(error)
  );
}

function isUserRejection(error) {
  return (
    error?.code === 4001 ||
    error?.code === "ACTION_REJECTED" ||
    error?.code === "4001" ||
    error?.info?.error?.code === 4001
  );
}

function addActivity(message) {
  const placeholder = activityList.querySelector(".muted");
  if (placeholder) {
    activityList.innerHTML = "";
  }

  const item = document.createElement("li");
  item.textContent = message;
  activityList.prepend(item);

  while (activityList.children.length > 30) {
    activityList.removeChild(activityList.lastElementChild);
  }
}

function getEventKey(event) {
  const log = event.log || event;
  return (
    (log.transactionHash || event.transactionHash || "") +
    ":" +
    (log.index ?? log.logIndex ?? event.index ?? "")
  );
}

async function refreshNetworkLabel() {
  try {
    const network = await readProvider.getNetwork();
    networkLabel.textContent =
      "Read network: " +
      network.name +
      " (Chain ID: " +
      network.chainId.toString() +
      ")";
  } catch (error) {
    networkLabel.textContent =
      "Could not read network: " + formatError(error);
  }
}

async function refreshState() {
  try {
    const [message, poster, count] = await Promise.all([
      readContract.getLatestMessage(),
      readContract.lastPoster(),
      readContract.messageCount()
    ]);

    latestMessageLabel.textContent =
      message && message.length > 0 ? message : "No messages posted yet.";

    lastPosterLabel.textContent =
      poster === ethers.ZeroAddress ? "—" : poster;

    messageCountLabel.textContent = count.toString();

    return true;
  } catch (error) {
    setStatus("Could not refresh contract state: " + formatError(error));
    return false;
  }
}

async function loadContract() {
  const response = await fetch("./contract.json");

  if (!response.ok) {
    throw new Error("Could not load contract.json.");
  }

  artifact = await response.json();

  if (Number(artifact.chainId) !== Number(EXPECTED_CHAIN_ID)) {
    throw new Error("contract.json has an unexpected chain ID.");
  }

  readProvider = new ethers.JsonRpcProvider(RPC_URL);

  readContract = new ethers.Contract(
    artifact.address,
    artifact.abi,
    readProvider
  );

  await refreshNetworkLabel();
  await refreshState();
  await loadRecentEvents();
  startEventListener();
}

async function ensureCorrectNetwork() {
  if (!window.ethereum) {
    throw new Error("MetaMask was not detected.");
  }

  const currentChainId = await window.ethereum.request({
    method: "eth_chainId"
  });

  if (currentChainId.toLowerCase() !== EXPECTED_CHAIN_HEX) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: EXPECTED_CHAIN_HEX }]
      });
    } catch (error) {
      if (error.code !== 4902) {
        throw error;
      }

      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: EXPECTED_CHAIN_HEX,
          chainName: "DIDLab",
          nativeCurrency: {
            name: "TRUST",
            symbol: "TRUST",
            decimals: 18
          },
          rpcUrls: [RPC_URL],
          blockExplorerUrls: ["https://explorer.didlab.org"]
        }]
      });
    }
  }

  const verifiedChainId = await window.ethereum.request({
    method: "eth_chainId"
  });

  if (verifiedChainId.toLowerCase() !== EXPECTED_CHAIN_HEX) {
    throw new Error("Please switch MetaMask to the DIDLab network.");
  }
}

async function connectWallet() {
  try {
    if (!window.ethereum) {
      throw new Error("MetaMask was not detected. Please enable MetaMask.");
    }

    await ensureCorrectNetwork();

    walletProvider = new ethers.BrowserProvider(window.ethereum);

    await walletProvider.send("eth_requestAccounts", []);

    signer = await walletProvider.getSigner();

    writeContract = new ethers.Contract(
      artifact.address,
      artifact.abi,
      signer
    );

    const address = await signer.getAddress();
    walletLabel.textContent = "Connected wallet: " + address;

    const network = await walletProvider.getNetwork();
    if (network.chainId !== EXPECTED_CHAIN_ID) {
      throw new Error("Connected wallet is not on DIDLab.");
    }

    setStatus("Wallet connected to DIDLab.");
  } catch (error) {
    setStatus("Wallet connection failed: " + formatError(error));
  }
}

function validateMessage(message) {
  const byteLength = ethers.toUtf8Bytes(message).length;

  if (byteLength === 0) {
    throw new Error("Message cannot be empty.");
  }

  if (byteLength > 280) {
    throw new Error("Message must be 280 bytes or fewer.");
  }
}

async function simulateWrite() {
  try {
    if (!writeContract) {
      throw new Error("Connect your wallet first.");
    }

    const message = messageInput.value.trim();
    validateMessage(message);
    await ensureCorrectNetwork();

    setStatus("Simulating transaction...");

    await writeContract.postMessage.staticCall(message);

    const gas = await writeContract.postMessage.estimateGas(message);

    setStatus("Simulation succeeded. Estimated gas: " + gas.toString());
  } catch (error) {
    setStatus("Simulation failed: " + formatError(error));
  }
}

async function postMessage() {
  let tx;

  try {
    if (!writeContract) {
      throw new Error("Connect your wallet first.");
    }

    const message = messageInput.value.trim();

    validateMessage(message);
    await ensureCorrectNetwork();

    setStatus("Simulating transaction...");

    await writeContract.postMessage.staticCall(message);

    const gas = await writeContract.postMessage.estimateGas(message);

    setStatus("Simulation passed. Waiting for wallet approval...");

    tx = await writeContract.postMessage(message, {
      gasLimit: (gas * 120n) / 100n
    });

    setStatus("Transaction pending: " + tx.hash);
    addActivity("Pending transaction: " + tx.hash);

    const receipt = await tx.wait();

    if (!receipt || Number(receipt.status) !== 1) {
      setStatus("Transaction reverted on-chain. State was not updated.");
      addActivity("Transaction reverted: " + tx.hash);
      return;
    }

    addActivity("Transaction confirmed: " + tx.hash);

    // FIX: Explicitly refresh state after the transaction is confirmed.
    setStatus("Transaction confirmed. Refreshing message board...");
    await refreshState();
    await loadRecentEvents();

    setStatus("Transaction confirmed in block " + receipt.blockNumber);
  } catch (error) {
    if (isUserRejection(error)) {
      setStatus("Transaction rejected in wallet. No transaction was sent.");
      addActivity("Wallet transaction rejected.");
    } else if (error?.receipt?.status === 0) {
      setStatus("Transaction reverted on-chain. State was not updated.");
      addActivity("Transaction reverted: " + (tx?.hash || ""));
    } else {
      setStatus("Transaction failed: " + formatError(error));
      addActivity("Transaction failed: " + formatError(error));
    }
  }
}

async function loadRecentEvents() {
  try {
    const latestBlock = await readProvider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 5000);

    const events = await readContract.queryFilter(
      readContract.filters.MessagePosted(),
      fromBlock,
      latestBlock
    );

    for (const event of events) {
      const key = getEventKey(event);

      if (!seenEvents.has(key)) {
        seenEvents.add(key);

        addActivity(
          "Message posted by " +
          event.args.poster +
          ": " +
          event.args.message +
          " (total: " +
          event.args.totalMessages.toString() +
          ")"
        );
      }
    }
  } catch (error) {
    addActivity("Could not load historical events: " + formatError(error));
  }
}

function startEventListener() {
  if (eventListenerStarted) return;
  eventListenerStarted = true;

  const filter = readContract.filters.MessagePosted();

  readContract.on(
    filter,
    async (poster, message, totalMessages, event) => {
      const key = getEventKey(event);

      if (!seenEvents.has(key)) {
        seenEvents.add(key);

        addActivity(
          "New on-chain message from " +
          poster +
          ": " +
          message +
          " (total: " +
          totalMessages.toString() +
          ")"
        );
      }

      // Keep the display updated when an event is received.
      await refreshState();
    }
  );
}

connectButton.addEventListener("click", connectWallet);

refreshButton.addEventListener("click", async () => {
  setStatus("Refreshing from DIDLab...");
  const refreshed = await refreshState();
  await loadRecentEvents();

  if (refreshed) {
    setStatus("Message board refreshed from DIDLab.");
  }
});

simulateButton.addEventListener("click", simulateWrite);
postButton.addEventListener("click", postMessage);

messageInput.addEventListener("input", () => {
  characterCount.textContent =
    ethers.toUtf8Bytes(messageInput.value).length + " bytes";
});

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => {
    signer = null;
    writeContract = null;
    walletProvider = null;

    walletLabel.textContent = "Account changed. Reconnect your wallet.";
    setStatus("Wallet account changed. Click Connect Wallet again.");
  });

  window.ethereum.on("chainChanged", () => {
    signer = null;
    writeContract = null;
    walletProvider = null;

    walletLabel.textContent = "Network changed. Reconnect your wallet.";
    setStatus("Network changed. Click Connect Wallet to verify DIDLab.");
  });
}

loadContract().catch((error) => {
  setStatus("App initialization failed: " + formatError(error));
});
