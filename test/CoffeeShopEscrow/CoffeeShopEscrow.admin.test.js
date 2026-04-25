const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CoffeeShopEscrow - admin", function () {
    let owner, customer, other;
    let shop, usdt;
    let customerAddress, storeAddress, shopAddress;
    let DECIMALS, americanoPrice, itemId;

    beforeEach(async function () {
        DECIMALS = 6;
        americanoPrice = ethers.parseUnits("3", DECIMALS);
        itemId = 1n;

        [owner, customer, other] = await ethers.getSigners();

        customerAddress = await customer.getAddress();
        storeAddress = await owner.getAddress();

        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        usdt = await MockUSDT.deploy();
        await usdt.waitForDeployment();

        const CoffeeShopEscrow = await ethers.getContractFactory("CoffeeShopEscrow");
        shop = await CoffeeShopEscrow.deploy(
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
    });

    describe("onlyOwner", function () {
        it("reverts when non-owner calls createItem", async function () {
            await expect(
                shop.connect(customer).createItem(
                    "Latte",
                    ethers.parseUnits("2", DECIMALS),
                    true
                )
            ).to.be.revertedWith("not owner");
        });

        it("reverts when non-owner calls updateItem", async function () {
            await expect(
                shop.connect(customer).updateItem(
                    itemId,
                    "Mocha",
                    ethers.parseUnits("5", DECIMALS),
                    true
                )
            ).to.be.revertedWith("not owner");
        });

        it("reverts when non-owner calls setPrice", async function () {
            await expect(
                shop.connect(customer).setPrice(
                    itemId,
                    ethers.parseUnits("6", DECIMALS)
                )
            ).to.be.revertedWith("not owner");
        });

        it("reverts when non-owner calls setItemActive", async function () {
            await expect(
                shop.connect(customer).setItemActive(itemId, false)
            ).to.be.revertedWith("not owner");
        });

        it("reverts when non-owner calls setPaused", async function () {
            await expect(
                shop.connect(customer).setPaused(true)
            ).to.be.revertedWith("not owner");
        });

        it("reverts when non-owner calls setStoreWallet", async function () {
            await expect(
                shop.connect(customer).setStoreWallet(customerAddress)
            ).to.be.revertedWith("not owner");
        });

        it("reverts when non-owner calls withdraw", async function () {
            await shop.connect(customer).buy(itemId, 1n);

            await expect(
                shop.connect(customer).withdraw(1n)
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
                shop.createItem("Latte", 0, true)
            ).to.be.revertedWith("price must be > 0");
        });

        it("creates item correctly", async function () {
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
        it("reverts when item does not exist", async function () {
            await expect(
                shop.updateItem(
                    999,
                    "Mocha",
                    ethers.parseUnits("5", DECIMALS),
                    true
                )
            ).to.be.revertedWith("item not found");
        });

        it("reverts when name is empty", async function () {
            await expect(
                shop.updateItem(
                    itemId,
                    "",
                    ethers.parseUnits("5", DECIMALS),
                    true
                )
            ).to.be.revertedWith("name empty");
        });

        it("reverts when new price is zero", async function () {
            await expect(
                shop.updateItem(itemId, "Mocha", 0, true)
            ).to.be.revertedWith("price must be > 0");
        });

        it("updates item correctly", async function () {
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
        it("reverts when item does not exist", async function () {
            await expect(
                shop.setPrice(999, ethers.parseUnits("5", DECIMALS))
            ).to.be.revertedWith("item not found");
        });

        it("reverts when new price is zero", async function () {
            await expect(
                shop.setPrice(itemId, 0)
            ).to.be.revertedWith("price must be > 0");
        });

        it("updates only the price", async function () {
            const newPrice = ethers.parseUnits("7", DECIMALS);

            await expect(
                shop.setPrice(itemId, newPrice)
            ).to.emit(shop, "ItemUpdated").withArgs(
                itemId,
                "Americano",
                americanoPrice,
                newPrice,
                true
            );

            const item = await shop.getItem(itemId);

            expect(item[0]).to.equal("Americano");
            expect(item[1]).to.equal(newPrice);
            expect(item[2]).to.equal(true);
            expect(item[3]).to.equal(true);
        });
    });

    describe("setItemActive", function () {
        it("reverts when item does not exist", async function () {
            await expect(
                shop.setItemActive(999, false)
            ).to.be.revertedWith("item not found");
        });

        it("sets item inactive", async function () {
            await expect(
                shop.setItemActive(itemId, false)
            ).to.emit(shop, "ItemStatusUpdated").withArgs(itemId, false);

            const item = await shop.getItem(itemId);

            expect(item[0]).to.equal("Americano");
            expect(item[1]).to.equal(americanoPrice);
            expect(item[2]).to.equal(false);
            expect(item[3]).to.equal(true);
        });

        it("sets item active again", async function () {
            await shop.setItemActive(itemId, false);

            await expect(
                shop.setItemActive(itemId, true)
            ).to.emit(shop, "ItemStatusUpdated").withArgs(itemId, true);

            const item = await shop.getItem(itemId);
            expect(item[2]).to.equal(true);
        });
    });

    describe("setStoreWallet", function () {
        it("reverts when new wallet is zero address", async function () {
            await expect(
                shop.setStoreWallet(ethers.ZeroAddress)
            ).to.be.revertedWith("zero store wallet");
        });

        it("updates store wallet correctly", async function () {
            const oldWallet = await shop.storeWallet();
            const newWallet = customerAddress;
            await expect(
                shop.setStoreWallet(newWallet)
            ).to.emit(shop, "StoreWalletUpdated").withArgs(
                oldWallet,
                newWallet
            );

            expect(await shop.storeWallet()).to.equal(newWallet);
        });
    });

    describe("setPaused", function () {
        it("pauses sales", async function () {
            await expect(
                shop.setPaused(true)
            ).to.emit(shop, "SalesPaused").withArgs(true);

            expect(await shop.paused()).to.equal(true);
        });

        it("unpauses sales", async function () {
            await shop.setPaused(true);

            await expect(
                shop.setPaused(false)
            ).to.emit(shop, "SalesPaused").withArgs(false);

            expect(await shop.paused()).to.equal(false);
        });
    });
});