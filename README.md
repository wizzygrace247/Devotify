# Devotify

### Transparent voting without forcing every participant to own a wallet


Devotify is a hybrid decentralized voting platform designed for real-world groups — schools, student unions, clubs, DAOs, and communities — that need trustworthy elections without crypto complexity.

Creators pay gas once.  
Voters can participate with a wallet **or** an ID / password.  
Results remain verifiable on the blockchain.

---

## Problem

Digital voting usually falls into two extremes:

- **Centralized tools** are easy to use, but hard to audit and easy to distrust
- **Fully on-chain tools** are transparent, but exclude people without wallets or gas fees

That creates a gap for organizations that want both **accessibility** and **verifiability**.

---

## Solution

Devotify combines on-chain integrity with off-chain usability.

### Core idea
- Only the **election creator** needs a wallet and pays gas
- Participants can vote through:
  - **Open mode** — wallet registration
  - **ID mode** — identity key provided by the organizer
  - **Credential mode** — ID + password, no separate registration step
- Final results can be revealed and independently checked against an on-chain hash

This makes blockchain voting practical for non-crypto users.

---

## Key Features

- Create elections with topics, options, and time windows
- Creator-controlled participation modes
- Wallet-optional voting flows
- DVY test token + faucet for Sepolia testing
- On-chain vote recording and result verification
- Live deployed frontend and backend

---

## Demo

- **Live app:** [https://devotify.vercel.app](https://devotify.vercel.app)
- **Backend API docs:** [https://devotify-production.up.railway.app/docs](https://devotify-production.up.railway.app/docs)
- **Network:** Ethereum Sepolia

> Replace contract addresses below with your actual deployed addresses if needed.

---

## How it works

1. Creator connects wallet and claims test DVY if needed  
2. Creator launches an election and chooses a participation mode  
3. Voters join through wallet, identity key, or credentials  
4. Votes are processed and recorded  
5. Creator reveals results after voting ends  
6. Anyone can verify the result hash on-chain  

---

## Tech Stack

| Area | Tools |
|------|--------|
| Frontend | React, TypeScript, Vite, Wagmi, RainbowKit |
| Backend | FastAPI, Python, Web3.py |
| Smart Contracts | Solidity, Hardhat, OpenZeppelin |
| Blockchain | Ethereum Sepolia |
| Deployment | Vercel, Railway |

---

## Why this matters

Devotify is not just another blockchain voting demo.

It is designed around a practical constraint:

> Transparency should not require every voter to become a crypto user first.

That makes it relevant for campuses, student governance, community polls, and early DAO experimentation.

---

## What we built for Brainwave 2026

- Working MVP with real contracts on Sepolia
- Hybrid architecture balancing usability and auditability
- Multiple participation modes for different organizer needs
- End-to-end deployed product, not only local code

---

## Challenges

- Supporting wallet and non-wallet users in one product
- Keeping on-chain verification while improving UX
- Production issues around CORS, environment variables, and deployment
- Scope control while still shipping a usable MVP

---

## What’s next

- L2 deployment for lower costs
- Stronger identity / anti-Sybil options
- Privacy-preserving voting features
- Better organizer tools
- Pilot use with student groups or community organizations

---

## Team

Built as a practical experiment in making decentralized voting usable for everyday groups.

---

## Built with

`React` `TypeScript` `Python` `FastAPI` `Solidity` `Ethereum` `Wagmi` `RainbowKit` `Hardhat` `Vercel` `Railway` `Web3` `Blockchain`
