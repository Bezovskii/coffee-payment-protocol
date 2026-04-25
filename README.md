
## Overview

This project implements two blockchain-based payment models for a coffee shop using Solidity smart contracts:

- CoffeeShop (MoneyFlow): Direct payment from customer to store wallet
- CoffeeShopEscrow: Payment is held in the smart contract and can be withdrawn by the owner or refunded to the customer

---

## Contracts

### CoffeeShop.sol (MoneyFlow)
- Direct payment model
- Customer pays directly to store wallet
- Immediate transaction settlement

### CoffeeShopEscrow.sol
- Escrow-based payment model
- Funds are held in contract
- Owner can withdraw funds
- Customer can request refund

### MockUSDT.sol
- ERC20 mock token used for testing payments

### BadTokenReturnFalse.sol
- Mock token used to simulate failed transfers

---

## Payment Flows

### MoneyFlow (Direct Payment)

Customer → Store Wallet

- Payment is transferred instantly
- No intermediate state

---

### Escrow Model

Customer → Smart Contract

Then:

- Owner withdraws → Store Wallet
- Customer refunds → Customer

---

## Test Coverage

The system is fully tested with:

- Constructor validation
- Admin (onlyOwner) permissions
- Item creation and updates
- Buy logic
- Withdraw logic
- Refund logic
- State transition testing
- Invariant testing

All tests are passing.

---

## Project Structure

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
---

## How to Run

npm install
npx hardhat compile
npx hardhat test
---

## Deployment

npx hardhat run scripts/deployMoneyFlow.js
npx hardhat run scripts/deployEscrow.js
---

## Tech Stack

- Solidity
- Hardhat
- Ethers.js
- JavaScript

---

## Future Work

- AI-assisted escrow dispute resolution using off-chain automation, where an AI agent analyzes dispute context and suggests whether funds should be released, refunded, or escalated for human review.
