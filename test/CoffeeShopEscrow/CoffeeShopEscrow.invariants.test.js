const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CoffeeShopEscrow - invariants", function () {
  let owner, customer, other;
  let shop, usdt;
  let shopAddress, customerAddress, storeWallet;

  const DECIMALS = 6;
  const itemId = 1n;
  const orderId = 1n;
  const americanoPrice = ethers.parseUnits("3", DECIMALS);
  const enoughUSDT = ethers.parseUnits("1000", DECIMALS);

  beforeEach(async function () {
    [owner, customer, other] = await ethers.getSigners();

    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    usdt = await MockUSDT.deploy();
    await usdt.waitForDeployment();

    const CoffeeShopEscrow = await ethers.getContractFactory("CoffeeShopEscrow");
    shop = await CoffeeShopEscrow.deploy(
      await owner.getAddress(),
      await usdt.getAddress()
    );
    await shop.waitForDeployment();

    shopAddress = await shop.getAddress();
    customerAddress = await customer.getAddress();
    storeWallet = await owner.getAddress();

    await usdt.mint(customerAddress, enoughUSDT);
    await usdt.connect(customer).approve(shopAddress, enoughUSDT);

    await shop.createItem("Americano", americanoPrice, true);
    await shop.connect(customer).buy(itemId, 1n);
  });

  it("repeated buys preserve order and balance correctness", async function () {
    const item = await shop.getItem(itemId);
    const price = item[1];

    let prevNextOrderId = await shop.nextOrderId();
    let prevCustomerBalance = await usdt.balanceOf(customerAddress);
    let prevShopBalance = await usdt.balanceOf(shopAddress);

    for (const qty of [1n, 2n, 3n, 4n, 5n]) {
      const expectedTotal = price * qty;

      const tx = await shop.connect(customer).buy(itemId, qty);
      await tx.wait();

      const newNextOrderId = await shop.nextOrderId();
      const newOrderId = newNextOrderId - 1n;

      expect(newNextOrderId).to.equal(prevNextOrderId + 1n);

      const o = await shop.orders(newOrderId);
      expect(o.customer).to.equal(customerAddress);
      expect(o.itemId).to.equal(itemId);
      expect(o.qty).to.equal(qty);
      expect(o.total).to.equal(expectedTotal);
      expect(o.status).to.equal(1n); // PAID

      const customerBalance = await usdt.balanceOf(customerAddress);
      const shopBalance = await usdt.balanceOf(shopAddress);

      expect(prevCustomerBalance - customerBalance).to.equal(expectedTotal);
      expect(shopBalance - prevShopBalance).to.equal(expectedTotal);

      prevNextOrderId = newNextOrderId;
      prevCustomerBalance = customerBalance;
      prevShopBalance = shopBalance;
    }
  });

  it("revert does not change balances or nextOrderId", async function () {
    await shop.connect(owner).setPaused(true);

    const beforeNext = await shop.nextOrderId();
    const beforeCustomer = await usdt.balanceOf(customerAddress);
    const beforeShop = await usdt.balanceOf(shopAddress);

    await expect(
      shop.connect(customer).buy(itemId, 1n)
    ).to.be.revertedWith("sales paused");

    const afterNext = await shop.nextOrderId();
    const afterCustomer = await usdt.balanceOf(customerAddress);
    const afterShop = await usdt.balanceOf(shopAddress);

    expect(afterNext).to.equal(beforeNext);
    expect(afterCustomer).to.equal(beforeCustomer);
    expect(afterShop).to.equal(beforeShop);
  });

  it("successful withdraw moves exactly order.total and updates status", async function () {
    const orderBefore = await shop.orders(orderId);
    const total = orderBefore.total;

    const contractBalanceBefore = await usdt.balanceOf(shopAddress);
    const storeWalletBalanceBefore = await usdt.balanceOf(storeWallet);

    await shop.connect(owner).withdraw(orderId);

    const orderAfter = await shop.orders(orderId);
    const contractBalanceAfter = await usdt.balanceOf(shopAddress);
    const storeWalletBalanceAfter = await usdt.balanceOf(storeWallet);
    expect(orderAfter.status).to.equal(2n); // WITHDRAWN
    expect(contractBalanceBefore - contractBalanceAfter).to.equal(total);
    expect(storeWalletBalanceAfter - storeWalletBalanceBefore).to.equal(total);
  });

  it("contract balance equals sum of PAID orders", async function () {
    let sum = 0n;
    const nextId = await shop.nextOrderId();

    for (let i = 1n; i < nextId; i++) {
      const o = await shop.orders(i);
      if (o.status == 1n) {
        sum += o.total;
      }
    }

    const contractBalance = await usdt.balanceOf(shopAddress);
    expect(contractBalance).to.equal(sum);
  });

  it("order core fields never change after withdraw", async function () {
    const before = await shop.orders(orderId);

    await shop.connect(owner).withdraw(orderId);

    const after = await shop.orders(orderId);

    expect(after.customer).to.equal(before.customer);
    expect(after.itemId).to.equal(before.itemId);
    expect(after.qty).to.equal(before.qty);
    expect(after.total).to.equal(before.total);
  });

  it("terminal withdraw state cannot be reused", async function () {
    await shop.connect(owner).withdraw(orderId);

    await expect(
      shop.connect(owner).withdraw(orderId)
    ).to.be.revertedWith("order not withdrawable");
  });

  it("refund moves exact amount and updates state", async function () {
    const before = await shop.orders(orderId);
    const total = before.total;

    const contractBefore = await usdt.balanceOf(shopAddress);
    const customerBefore = await usdt.balanceOf(customerAddress);

    await shop.connect(customer).refund(orderId);

    const after = await shop.orders(orderId);
    const contractAfter = await usdt.balanceOf(shopAddress);
    const customerAfter = await usdt.balanceOf(customerAddress);

    expect(after.status).to.equal(3n); // REFUNDED
    expect(contractBefore - contractAfter).to.equal(total);
    expect(customerAfter - customerBefore).to.equal(total);
  });
});