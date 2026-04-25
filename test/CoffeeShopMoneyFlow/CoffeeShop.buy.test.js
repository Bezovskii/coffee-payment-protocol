const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CoffeeShop - buy", function () {
  let owner, customer, poorCustomer;
  let usdt, shop;
  let customerAddress, storeAddress, shopAddress;
  let DECIMALS, americanoPrice, itemId;

  beforeEach(async function () {
    DECIMALS = 6;
    americanoPrice = ethers.parseUnits("3", DECIMALS);

    [owner, customer, poorCustomer] = await ethers.getSigners();

    customerAddress = await customer.getAddress();
    storeAddress = await owner.getAddress();

    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    usdt = await MockUSDT.deploy();
    await usdt.waitForDeployment();

    const CoffeeShop = await ethers.getContractFactory("contracts/CoffeeShop.sol:CoffeeShop");
    shop = await CoffeeShop.deploy(
      storeAddress,
      await usdt.getAddress()
    );
    await shop.waitForDeployment();

    shopAddress = await shop.getAddress();

    await usdt.mint(customerAddress, ethers.parseUnits("1000", DECIMALS));
    await usdt
      .connect(customer)
      .approve(shopAddress, ethers.parseUnits("1000", DECIMALS));

    await shop.createItem("Americano", americanoPrice, true);
    itemId = 1n;
  });

  describe("reverts", function () {
    it("reverts when qty = 0", async function () {
      await expect(
        shop.connect(customer).buy(itemId, 0)
      ).to.be.revertedWith("qty must be > 0");
    });

    it("reverts when item is not found", async function () {
      await expect(
        shop.connect(customer).buy(999, 1)
      ).to.be.revertedWith("item not found");
    });

    it("reverts when item is not for sale (inactive)", async function () {
      await shop.createItem("Late", ethers.parseUnits("2000", DECIMALS), false);

      await expect(
        shop.connect(customer).buy(2, 1)
      ).to.be.revertedWith("item not for sale");
    });

    it("reverts when sales are paused", async function () {
      await shop.setPaused(true);

      await expect(
        shop.connect(customer).buy(itemId, 1)
      ).to.be.revertedWith("sales paused");
    });

    it("reverts when allowance is too low", async function () {
      await usdt
        .connect(customer)
        .approve(shopAddress, ethers.parseUnits("2", DECIMALS));

      await expect(
        shop.connect(customer).buy(itemId, 1)
      ).to.be.revertedWith("allowance too low");
    });

    it("reverts when balance is too low", async function () {
      await usdt
        .connect(poorCustomer)
        .approve(shopAddress, ethers.parseUnits("1000", DECIMALS));

      await expect(
        shop.connect(poorCustomer).buy(itemId, 1)
      ).to.be.revertedWith("not enough USDT");
    });

    it("reverts when token transferFrom returns false", async function () {
      const Bad = await ethers.getContractFactory("BadTokenReturnFalse");
      const bad = await Bad.deploy();
      await bad.waitForDeployment();

      const badStoreAddress = await owner.getAddress();

      const CoffeeShop = await ethers.getContractFactory("contracts/CoffeeShop.sol:CoffeeShop");
      const badShop = await CoffeeShop.deploy(
        badStoreAddress,
        await bad.getAddress()
      );
      await badShop.waitForDeployment();

      await badShop.createItem(
        "Americano",
        ethers.parseUnits("3", DECIMALS),
        true
      );

      await expect(
        badShop.connect(customer).buy(1, 1)
      ).to.be.revertedWith("transfer failed");
    });
  });

  describe("success", function () {
    it("successfully buys an item", async function () {
      const qty = 1n;
      const total = americanoPrice * qty;
      const orderIdBefore = await shop.nextOrderId();

      const customerBefore = await usdt.balanceOf(customerAddress);
      const storeBefore = await usdt.balanceOf(storeAddress);
      const allowanceBefore = await usdt.allowance(customerAddress, shopAddress);

      await expect(
        shop.connect(customer).buy(itemId, qty)
      ).to.emit(shop, "OrderPlaced").withArgs(
        orderIdBefore,
        customerAddress,
        itemId,
        qty,
        total
      );
      const customerAfter = await usdt.balanceOf(customerAddress);
      const storeAfter = await usdt.balanceOf(storeAddress);
      const allowanceAfter = await usdt.allowance(customerAddress, shopAddress);
      const orderIdAfter = await shop.nextOrderId();

      expect(storeAfter - storeBefore).to.equal(total);
      expect(customerBefore - customerAfter).to.equal(total);
      expect(allowanceBefore - allowanceAfter).to.equal(total);
      expect(orderIdAfter).to.equal(orderIdBefore + 1n);
    });
  });
});