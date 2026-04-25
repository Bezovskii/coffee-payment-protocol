const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CoffeeShop - transitions", function () {
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

  it("blocks buy when paused and allows buy again after unpausing", async function () {
    const qty = 1n;
    const total = americanoPrice * qty;

    await shop.setPaused(true);

    await expect(
      shop.connect(customer).buy(itemId, qty)
    ).to.be.revertedWith("sales paused");

    await shop.setPaused(false);

    const orderIdBefore = await shop.nextOrderId();

    await expect(
      shop.connect(customer).buy(itemId, qty)
    ).to.emit(shop, "OrderPlaced").withArgs(
      orderIdBefore,
      customerAddress,
      itemId,
      qty,
      total
    );
  });

  it("sends payment to the new store wallet after wallet update", async function () {
    const qty = 1n;
    const total = americanoPrice * qty;

    const oldWallet = storeAddress;
    const newWallet = await poorCustomer.getAddress();

    const customerBefore = await usdt.balanceOf(customerAddress);
    const oldWalletBefore = await usdt.balanceOf(oldWallet);
    const newWalletBefore = await usdt.balanceOf(newWallet);

    await shop.setStoreWallet(newWallet);
    await shop.connect(customer).buy(itemId, qty);

    const oldWalletAfter = await usdt.balanceOf(oldWallet);
    const newWalletAfter = await usdt.balanceOf(newWallet);
    const customerAfter = await usdt.balanceOf(customerAddress);

    expect(oldWalletAfter - oldWalletBefore).to.equal(0n);
    expect(newWalletAfter - newWalletBefore).to.equal(total);
    expect(customerBefore - customerAfter).to.equal(total);
  });

  it("uses updated price in buy", async function () {
    const qty = 2n;
    const newPrice = ethers.parseUnits("10", DECIMALS);
    const total = qty * newPrice;

    await shop.setPrice(itemId, newPrice);

    const orderIdBefore = await shop.nextOrderId();
    const storeBefore = await usdt.balanceOf(storeAddress);
    const customerBefore = await usdt.balanceOf(customerAddress);

    await expect(
      shop.connect(customer).buy(itemId, qty)
    ).to.emit(shop, "OrderPlaced").withArgs(
      orderIdBefore,
      customerAddress,
      itemId,
      qty,
      total
    );

    const storeAfter = await usdt.balanceOf(storeAddress);
    const customerAfter = await usdt.balanceOf(customerAddress);

    expect(storeAfter - storeBefore).to.equal(total);
    expect(customerBefore - customerAfter).to.equal(total);
  });

  it("successfully changes item activation status and buys again", async function () {
    const qty = 2n;
    const total = qty * americanoPrice;

    await shop.setItemActive(itemId, false);

    await expect(
      shop.connect(customer).buy(itemId, qty)
    ).to.be.revertedWith("item not for sale");

    await shop.setItemActive(itemId, true);

    const orderIdBefore = await shop.nextOrderId();
    await expect(
      shop.connect(customer).buy(itemId, qty)
    ).to.emit(shop, "OrderPlaced").withArgs(
      orderIdBefore,
      customerAddress,
      itemId,
      qty,
      total
    );
  });
});