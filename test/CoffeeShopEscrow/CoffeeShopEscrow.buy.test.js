const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CoffeeShopEscrow - buy", function () {
  let owner, customer, other;
  let shop, usdt;
  let shopAddress, customerAddress;
  let DECIMALS, americanoPrice, itemId1;

  beforeEach(async function () {
    DECIMALS = 6;
    itemId1 = 1n;
    americanoPrice = ethers.parseUnits("3", DECIMALS);

    [owner, customer, other] = await ethers.getSigners();
    customerAddress = await customer.getAddress();

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

    await usdt.mint(customerAddress, ethers.parseUnits("1000", DECIMALS));
    await usdt
      .connect(customer)
      .approve(shopAddress, ethers.parseUnits("1000", DECIMALS));

    await shop.createItem("Americano", americanoPrice, true);
  });

  describe("reverts", function () {
    it("reverts when qty is zero", async function () {
      await expect(
        shop.connect(customer).buy(itemId1, 0)
      ).to.be.revertedWith("qty must be > 0");
    });

    it("reverts when sales are paused", async function () {
      await shop.connect(owner).setPaused(true);

      await expect(
        shop.connect(customer).buy(itemId1, 1)
      ).to.be.revertedWith("sales paused");
    });

    it("reverts when item is not found", async function () {
      await expect(
        shop.connect(customer).buy(999, 1)
      ).to.be.revertedWith("item not found");
    });

    it("reverts when item is not for sale (inactive)", async function () {
      await shop.createItem("Latte", ethers.parseUnits("4", DECIMALS), false);

      await expect(
        shop.connect(customer).buy(2, 1)
      ).to.be.revertedWith("item not for sale");
    });

    it("reverts when allowance is too low", async function () {
      await usdt
        .connect(customer)
        .approve(shopAddress, ethers.parseUnits("2", DECIMALS));

      await expect(
        shop.connect(customer).buy(itemId1, 1)
      ).to.be.revertedWith("allowance too low");
    });

    it("reverts when balance is too low", async function () {
      const poorCustomer = other;

      await usdt
        .connect(poorCustomer)
        .approve(shopAddress, ethers.parseUnits("1000", DECIMALS));

      await expect(
        shop.connect(poorCustomer).buy(itemId1, 1)
      ).to.be.revertedWith("not enough USDT");
    });
  });

  describe("success", function () {
    it("successfully buys 1 item and stores the order", async function () {
      const qty = 1n;
      const orderId = 1n;
      const total = americanoPrice * qty;

      const customerBefore = await usdt.balanceOf(customerAddress);
      const shopBefore = await usdt.balanceOf(shopAddress);
      const allowanceBefore = await usdt.allowance(customerAddress, shopAddress);

      await expect(
        shop.connect(customer).buy(itemId1, qty)
      ).to.emit(shop, "OrderPlaced").withArgs(
        orderId,
        customerAddress,
        itemId1,
        qty,
        total
      );

      const customerAfter = await usdt.balanceOf(customerAddress);
      const shopAfter = await usdt.balanceOf(shopAddress);
      const allowanceAfter = await usdt.allowance(customerAddress, shopAddress);

      expect(customerBefore - customerAfter).to.equal(total);
      expect(shopAfter - shopBefore).to.equal(total);
      expect(allowanceBefore - allowanceAfter).to.equal(total);

      const order = await shop.orders(orderId);
      expect(order.customer).to.equal(customerAddress);
      expect(order.itemId).to.equal(itemId1);
      expect(order.qty).to.equal(qty);
      expect(order.total).to.equal(total);
      expect(order.status).to.equal(1n); // PAID

      expect(await shop.nextOrderId()).to.equal(2n);
    });
    it("successfully buys with qty = 3", async function () {
      const qty = 3n;
      const orderId = 1n;
      const total = americanoPrice * qty;

      const customerBefore = await usdt.balanceOf(customerAddress);
      const shopBefore = await usdt.balanceOf(shopAddress);

      await expect(
        shop.connect(customer).buy(itemId1, qty)
      ).to.emit(shop, "OrderPlaced").withArgs(
        orderId,
        customerAddress,
        itemId1,
        qty,
        total
      );

      const customerAfter = await usdt.balanceOf(customerAddress);
      const shopAfter = await usdt.balanceOf(shopAddress);

      expect(customerBefore - customerAfter).to.equal(total);
      expect(shopAfter - shopBefore).to.equal(total);

      const order = await shop.orders(orderId);
      expect(order.qty).to.equal(qty);
      expect(order.total).to.equal(total);
      expect(order.status).to.equal(1n);

      expect(await shop.nextOrderId()).to.equal(2n);
    });

    it("successfully buys a different item", async function () {
      const lattePrice = ethers.parseUnits("4", DECIMALS);
      const latteId = 2n;
      const qty = 1n;
      const orderId = 1n;
      const total = lattePrice * qty;

      await shop.createItem("Latte", lattePrice, true);

      const customerBefore = await usdt.balanceOf(customerAddress);
      const shopBefore = await usdt.balanceOf(shopAddress);

      await expect(
        shop.connect(customer).buy(latteId, qty)
      ).to.emit(shop, "OrderPlaced").withArgs(
        orderId,
        customerAddress,
        latteId,
        qty,
        total
      );

      const customerAfter = await usdt.balanceOf(customerAddress);
      const shopAfter = await usdt.balanceOf(shopAddress);

      expect(customerBefore - customerAfter).to.equal(total);
      expect(shopAfter - shopBefore).to.equal(total);

      const order = await shop.orders(orderId);
      expect(order.itemId).to.equal(latteId);
      expect(order.total).to.equal(total);
      expect(order.status).to.equal(1n);

      expect(await shop.nextOrderId()).to.equal(2n);
    });

    it("successfully buys twice and stores both orders", async function () {
      const lattePrice = ethers.parseUnits("4", DECIMALS);
      const latteId = 2n;
      const qty = 1n;

      await shop.createItem("Latte", lattePrice, true);

      const totalAmericano = americanoPrice * qty;
      const totalLatte = lattePrice * qty;
      const totalSpent = totalAmericano + totalLatte;

      const customerBefore = await usdt.balanceOf(customerAddress);
      const shopBefore = await usdt.balanceOf(shopAddress);

      await expect(
        shop.connect(customer).buy(itemId1, qty)
      ).to.emit(shop, "OrderPlaced").withArgs(
        1n,
        customerAddress,
        itemId1,
        qty,
        totalAmericano
      );

      await expect(
        shop.connect(customer).buy(latteId, qty)
      ).to.emit(shop, "OrderPlaced").withArgs(
        2n,
        customerAddress,
        latteId,
        qty,
        totalLatte
      );

      const customerAfter = await usdt.balanceOf(customerAddress);
      const shopAfter = await usdt.balanceOf(shopAddress);

      expect(customerBefore - customerAfter).to.equal(totalSpent);
      expect(shopAfter - shopBefore).to.equal(totalSpent);

      const order1 = await shop.orders(1n);
      const order2 = await shop.orders(2n);

      expect(order1.customer).to.equal(customerAddress);
      expect(order2.customer).to.equal(customerAddress);

      expect(order1.itemId).to.equal(itemId1);
      expect(order2.itemId).to.equal(latteId);

      expect(order1.total).to.equal(totalAmericano);
      expect(order2.total).to.equal(totalLatte);

      expect(order1.status).to.equal(1n);
      expect(order2.status).to.equal(1n);

      expect(await shop.nextOrderId()).to.equal(3n);
    });
  });
});