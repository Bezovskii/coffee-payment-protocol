# CoffeeShop Smart Contract System

## Overview

A Solidity-based smart contract system implementing two payment architectures: direct settlement and escrow-based transactions.

The project demonstrates **state-driven contract design**, **secure token handling**, and **full test coverage including invariants**, ensuring correctness across all execution paths.

---

## Design Approach

This system compares two transaction models:

- **MoneyFlow (Direct Payment)**  
  Optimized for speed and simplicity — funds are transferred immediately.

- **Escrow Model**  
  Designed for trustless environments — funds are locked and released based on conditions.

### Key Considerations
- Prevent invalid state transitions  
- Ensure payment integrity before state updates  
- Handle ERC20 edge cases (false returns / failed transfers)  
- Guarantee system correctness using invariant testing  

---

## Contracts

### CoffeeShop.sol (MoneyFlow)
- Direct payment model  
- Immediate transfer to store wallet  
- Minimal state complexity  

### CoffeeShopEscrow.sol
- Escrow-based payment model  
- Funds are held in contract  
- Controlled **withdrawal (owner)** and **refund (customer)**  
- State-based lifecycle enforcement  

### MockUSDT.sol
- ERC20 mock token (6 decimals) used for realistic testing  

### BadTokenReturnFalse.sol
- Simulates broken ERC20 behavior (transfer returning false)  

---

## Payment Flows

### MoneyFlow (Direct Payment)

Customer → Store Wallet  

- Immediate settlement  
- No intermediate state  

---

### Escrow Model

Customer → Smart Contract  

Then:
- Owner withdraws → Store Wallet  
- Customer refunds → Customer  

---

## Test Coverage

The system is fully tested using **Hardhat**:

- Constructor validation  
- Access control (onlyOwner)  
- Item creation and updates  
- Buy logic  
- Withdrawal logic  
- Refund logic  
- State transition testing  
- Invariant testing  

All tests are passing.

---

## Project Structure
```
contracts/
  CoffeeShop.sol
  CoffeeShopEscrow.sol
  MockUSDT.sol
  BadTokenReturnFalse.sol

test/
  CoffeeShopMoneyFlow/
  CoffeeShopEscrow/

scripts/
  deployMoneyFlow.js
  deployEscrow.js
```

## How to Run
```
npm install
npx hardhat compile
npx hardhat test
```

## Deployment
```
npx hardhat run scripts/deployMoneyFlow.js
npx hardhat run scripts/deployEscrow.js
```

## Tech Stack

- Solidity  
- Hardhat  
- Ethers.js  
- JavaScript  

---

## Future Work

- On-chain dispute resolution mechanism
- Integration with decentralized arbitration systems
- Frontend interface (React / Web3)
- Deployment to public testnet (Sepolia)
- Multi-vendor marketplace support
