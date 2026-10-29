# Security Review - MessageBoard.sol



## 1. Scope



| Item | Details |

|---|---|

| Contract | `MessageBoard.sol` |

| Solidity version | `^0.8.24` |

| Blockchain | DIDLab |

| Chain ID | `252501` |

| Contract address | `0xA19d2AeD9E040c56484821c210b7C48d79005284` |

| Deployment transaction | `0xfcd5c83a733feea72a792336d8ed3d33c0ccb8439b9c996c890d4c6d66390b32` |

| Deployment block | `6840117` |



The review focused on access control, input validation, reentrancy, unchecked external calls, and state ordering.



## 2. Method



The review used three methods:



1\. \*\*Manual source-code review:\*\* Inspected `MessageBoard.sol` for security issues in the five audit categories.

2\. \*\*AI-assisted audit:\*\* Used an AI-generated security audit to identify potential problems and areas requiring verification.

3\. \*\*Adversarial testing:\*\* Created and ran five Hardhat tests to verify the AI's claims and test important contract behavior.



The tests were run with:



`npx.cmd hardhat test .\\test\\MessageBoard.activity09.test.js`



\*\*Result: 5 passing tests.\*\*



## 3. Findings



| Function or area | Class | Scenario | Severity | Status |

|---|---|---|---|---|

| `postMessage()` | Access control | Any account can post a message and overwrite the latest message. This is intentional behavior for a public message board. | Informational | Accepted |

| `postMessage()` | Input validation | Empty messages and messages exceeding 280 bytes are rejected. | None identified | No fix needed |

| `postMessage()` | Reentrancy | The function does not make external calls or transfer funds, so there is no identified reentrancy path. | Not applicable | Not applicable |

| Contract-wide | Unchecked external calls | The contract does not make external contract calls that require return-value handling. | Not applicable | Not applicable |

| `postMessage()` | State ordering | The contract updates its state before emitting the `MessagePosted` event. | None identified | No fix needed |



No confirmed Critical, High, Medium, or Low severity vulnerability was identified in the reviewed contract.



## 4. AI Audit Verification - Activity 09



| # | AI claim | Class | Verification result | How it was checked |

|---|---|---|---|---|

| 1 | Anyone can call `postMessage()`. | Access control | Confirmed; accepted behavior | A second account successfully posted a new message and overwrote the previous one. |

| 2 | Empty messages are rejected. | Input validation | Confirmed | Test verified the `Message cannot be empty` revert reason. |

| 3 | Messages over 280 bytes are rejected. | Input validation | Confirmed | Test verified that a 281-byte message reverts with `Message too long`. |

| 4 | There is no identified reentrancy vulnerability. | Reentrancy | Confirmed | Source inspection found no external calls or transfers. |

| 5 | There are no unchecked external calls. | Unchecked external calls | Confirmed | Source inspection found no external contract interactions. |

| 6 | State changes happen before the event is emitted. | State ordering | Confirmed | Test verified the event and the updated message, poster, and message count. |



\*\*What the AI audit missed or did not fully establish:\*\*



The audit did not establish a confirmed security vulnerability that required a contract change. The public overwrite behavior deserves attention because it allows any user to replace the latest message, but this is consistent with the intended public message-board design.



The tests also used ASCII messages for the 280-byte boundary checks. Solidity measures the message length in bytes, not user-perceived characters. Multibyte UTF-8 messages can therefore reach the limit with fewer than 280 visible characters. This is an important behavior to document and test if character-count limits are required.



The Activity 6 findings concerning `AnchorRegistry.sol` are not findings against this contract and were not counted as missed MessageBoard vulnerabilities.



## 5. Fixes and Deployment Evidence



No confirmed vulnerability required a Solidity code change.



| Evidence field | Result |

|---|---|

| Finding requiring a fix | None identified |

| Contract changes | None |

| Before address | No previous deployment address established |

| New contract address | `0xA19d2AeD9E040c56484821c210b7C48d79005284` |

| Deployment transaction | `0xfcd5c83a733feea72a792336d8ed3d33c0ccb8439b9c996c890d4c6d66390b32` |

| Deployment block | `6840117` |

| Gas used | `600339` |

| Regression tests | Five Activity 09 verification tests passed |



Because no security fix was necessary, there was no before-and-after contract change and no redeployment after a fix. The deployment recorded above was an initial deployment of the reviewed contract to DIDLab.



The five tests provide evidence for the reviewed behavior, but they are verification tests rather than regression tests for a newly fixed vulnerability.



## 6. Residual Risk and Accepted Behavior



The contract has remaining limitations that are accepted for the current project's purpose:



\- \*\*Public message replacement:\*\* Any account can overwrite the latest message. This is intentional for a public message board, but users should not expect messages to remain permanently visible.

\- \*\*No moderation or access restrictions:\*\* The contract has no administrator function to remove messages or restrict users. This keeps the design simple but means unwanted messages cannot be removed through the contract.

\- \*\*Message length uses bytes:\*\* The 280-byte limit does not guarantee a maximum of 280 visible characters. This is acceptable for the current implementation, but the distinction should be understood by users.

\- \*\*Latest message only:\*\* The contract stores the latest message rather than a complete message history. Events provide a record of posts on the blockchain, but the contract does not provide a message-history retrieval function.



These risks are accepted because the current project is a simple public message board, not a moderated communication platform or a system storing confidential information. If the project later requires moderation, user restrictions, or permanent on-chain message history, the contract design should be reviewed again.



## 7. Key Management



The deployment script reads the following environment variables:



\- `DIDLAB\_RPC\_URL`

\- `DIDLAB\_PRIVATE\_KEY`



The private key is stored in the local `.env` file rather than directly in the Solidity source code.



The `.gitignore` file includes `.env` and `.env.\*`, which helps prevent environment files from being committed to the Git repository. However, `.gitignore` does not encrypt the file or protect it from someone who already has access to the computer.



\*\*Access:\*\* The deployment private key is accessible to anyone who can access the `.env` file or obtain an exposed copy or backup. For this project, access should be limited to the project owner and anyone explicitly authorized to manage the deployment wallet. Confirm who actually has access before submitting this report.



\*\*If the deployment private key leaks:\*\* An attacker could control the deployment wallet, spend its funds, and submit transactions using that account. However, `MessageBoard.sol` does not contain an administrator role or owner-only functions, so the deployment wallet cannot use an ADMIN function to change the contract's permissions or take control of message posting. Anyone can already post messages.



There is no separate ADMIN key in this contract. The deployment wallet's private key should still be protected, kept out of source control, and never shared. If it is exposed, the wallet should be treated as compromised and its remaining funds moved to a secure wallet.



\---



## Conclusion



The review identified no confirmed security vulnerability requiring a code change in `MessageBoard.sol`. The AI-assisted findings were checked against the source code and five passing adversarial verification tests. The public overwrite behavior and other design limitations were documented as accepted risks.



The reviewed contract was successfully deployed to DIDLab on chain ID `252501`. The deployment address and transaction hash are recorded in this report.




