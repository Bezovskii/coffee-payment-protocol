const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CoffeeShop - admin", function () {
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

  describe("onlyOwner", function () {
    it("reverts when non-owner calls createItem", async function () {
      await expect(
        shop.connect(customer).createItem("Latte", ethers.parseUnits("2", DECIMALS), true)
      ).to.be.revertedWith("not owner");
    });

    it("reverts when non-owner calls setPaused", async function () {
      await expect(
        shop.connect(customer).setPaused(true)
      ).to.be.revertedWith("not owner");
    });

    it("reverts when non-owner calls setItemActive", async function () {
      await expect(
        shop.connect(customer).setItemActive(itemId, false)
      ).to.be.revertedWith("not owner");
    });

    it("reverts when non-owner calls updateItem", async function () {
      await expect(
        shop.connect(customer).updateItem(itemId, "Americano", ethers.parseUnits("5", DECIMALS), true)
      ).to.be.revertedWith("not owner");
    });

    it("reverts when non-owner calls setPrice", async function () {
      await expect(
        shop.connect(customer).setPrice(itemId, ethers.parseUnits("6", DECIMALS))
      ).to.be.revertedWith("not owner");
    });

    it("reverts when non-owner calls setStoreWallet", async function () {
      await expect(
        shop.connect(customer).setStoreWallet(customerAddress)
      ).to.be.revertedWith("not owner");
    });
  });

  describe("createItem", function () {
    it("reverts when name is empty", async function () {
      await expect(
        shop.createItem("", americanoPrice, true)
      ).to.be.revertedWith("name empty");
    });

    it("reverts when price is zero", async function () {
      await expect(
        shop.createItem("Mocha", 0, true)
      ).to.be.revertedWith("price must be > 0");
    });

    it("successfully creates an item", async function () {
      const newName = "Latte";
      const newPrice = ethers.parseUnits("5", DECIMALS);
      const newActive = true;

      const nextItemIdBefore = await shop.nextItemId();
      const menuSizeBefore = await shop.getMenuSize();

      await expect(
        shop.createItem(newName, newPrice, newActive)
      ).to.emit(shop, "ItemCreated").withArgs(
        nextItemIdBefore,
        newName,
        newPrice,
        newActive
      );

      const nextItemIdAfter = await shop.nextItemId();
      const menuSizeAfter = await shop.getMenuSize();
      const item = await shop.getItem(nextItemIdBefore);

      expect(nextItemIdAfter).to.equal(nextItemIdBefore + 1n);
      expect(menuSizeAfter).to.equal(menuSizeBefore + 1n);
      expect(item[0]).to.equal(newName);
      expect(item[1]).to.equal(newPrice);
      expect(item[2]).to.equal(newActive);
      expect(item[3]).to.equal(true);
    });
  });
  describe("updateItem", function () {
    it("reverts when name is empty", async function () {
      await expect(
        shop.updateItem(itemId, "", americanoPrice, true)
      ).to.be.revertedWith("name empty");
    });

    it("reverts when new price is zero", async function () {
      await expect(
        shop.updateItem(itemId, "Mocha", 0, true)
      ).to.be.revertedWith("price must be > 0");
    });

    it("reverts when item does not exist", async function () {
      await expect(
        shop.updateItem(999, "Mocha", americanoPrice, false)
      ).to.be.revertedWith("item not found");
    });

    it("updates an item successfully", async function () {
      const newName = "Chai";
      const newPrice = ethers.parseUnits("6", DECIMALS);
      const newActive = false;
      const oldPrice = americanoPrice;

      await expect(
        shop.updateItem(itemId, newName, newPrice, newActive)
      ).to.emit(shop, "ItemUpdated").withArgs(
        itemId,
        newName,
        oldPrice,
        newPrice,
        newActive
      );

      const item = await shop.getItem(itemId);

      expect(item[0]).to.equal(newName);
      expect(item[1]).to.equal(newPrice);
      expect(item[2]).to.equal(newActive);
      expect(item[3]).to.equal(true);
    });
  });

  describe("setPrice", function () {
    it("reverts when price is zero", async function () {
      await expect(
        shop.setPrice(itemId, 0)
      ).to.be.revertedWith("price must be > 0");
    });

    it("reverts when item does not exist", async function () {
      await expect(
        shop.setPrice(999, americanoPrice)
      ).to.be.revertedWith("item not found");
    });

    it("successfully sets price", async function () {
      const oldName = "Americano";
      const oldPrice = americanoPrice;
      const newPrice = ethers.parseUnits("7", DECIMALS);
      const oldActive = true;

      await expect(
        shop.setPrice(itemId, newPrice)
      ).to.emit(shop, "ItemUpdated").withArgs(
        itemId,
        oldName,
        oldPrice,
        newPrice,
        oldActive
      );

      const item = await shop.getItem(itemId);

      expect(item[0]).to.equal(oldName);
      expect(item[1]).to.equal(newPrice);
      expect(item[2]).to.equal(oldActive);
      expect(item[3]).to.equal(true);
    });
  });

  describe("setItemActive", function () {
    it("reverts when item is not found", async function () {
      await expect(
        shop.setItemActive(999, true)
      ).to.be.revertedWith("item not found");
    });

    it("successfully sets item inactive", async function () {
      const newActive = false;

      await expect(
        shop.setItemActive(itemId, newActive)
      ).to.emit(shop, "ItemStatusUpdated").withArgs(itemId, newActive);

      const item = await shop.getItem(itemId);

      expect(item[0]).to.equal("Americano");
      expect(item[1]).to.equal(americanoPrice);
      expect(item[2]).to.equal(false);
      expect(item[3]).to.equal(true);
    });

    it("successfully sets item active again", async function () {
      await shop.setItemActive(itemId, false);

      await expect(
        shop.setItemActive(itemId, true)
      ).to.emit(shop, "ItemStatusUpdated").withArgs(itemId, true);

      const item = await shop.getItem(itemId);
      expect(item[2]).to.equal(true);
    });
  });

  describe("setStoreWallet", function () {
    it("reverts when new wallet address is zero", async function () {
      await expect(
        shop.setStoreWallet(ethers.ZeroAddress)
      ).to.be.revertedWith("zero store wallet");
    });

    it("successfully changes the store wallet address", async function () {
      const oldWallet = await shop.storeWallet();
      const newWallet = customerAddress;

      await expect(
        shop.setStoreWallet(newWallet)
      ).to.emit(shop, "StoreWalletUpdated").withArgs(oldWallet, newWallet);

      expect(await shop.storeWallet()).to.equal(newWallet);
    });
  });
  describe("setPaused", function () {
    it("successfully pauses sales", async function () {
      await expect(
        shop.setPaused(true)
      ).to.emit(shop, "SalesPaused").withArgs(true);

      expect(await shop.paused()).to.equal(true);
    });

    it("successfully unpauses sales", async function () {
      await shop.setPaused(true);

      await expect(
        shop.setPaused(false)
      ).to.emit(shop, "SalesPaused").withArgs(false);

      expect(await shop.paused()).to.equal(false);
    });
  });
});