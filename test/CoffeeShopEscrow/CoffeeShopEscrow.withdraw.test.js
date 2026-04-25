const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CoffeeShopEscrow - withdraw", function () {
    let owner, customer, other;
    let shop, usdt;
    let shopAddress, customerAddress, storeWallet;
    let itemId, orderId, DECIMALS, americanoPrice, enoughUSDT;

    beforeEach(async function () {
        itemId = 1n;
        orderId = 1n;
        DECIMALS = 6;
        americanoPrice = ethers.parseUnits("3", DECIMALS);
        enoughUSDT = ethers.parseUnits("1000", DECIMALS);

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

    describe("reverts", function () {
        it("reverts when msg.sender is not owner", async function () {
            await expect(
                shop.connect(customer).withdraw(orderId)
            ).to.be.revertedWith("not owner");
        });

        it("reverts when withdrawing a non-existent order", async function () {
            await expect(
                shop.connect(owner).withdraw(999n)
            ).to.be.revertedWith("order not withdrawable");
        });

        it("reverts when withdrawing the same order twice", async function () {
            await shop.connect(owner).withdraw(orderId);

            await expect(
                shop.connect(owner).withdraw(orderId)
            ).to.be.revertedWith("order not withdrawable");
        });
    });

    describe("success", function () {
        it("successfully withdraws funds to store wallet and updates status", async function () {
            const orderBefore = await shop.orders(orderId);
            const total = orderBefore.total;

            const contractBalanceBefore = await usdt.balanceOf(shopAddress);
            const storeWalletBalanceBefore = await usdt.balanceOf(storeWallet);

            await expect(
                shop.connect(owner).withdraw(orderId)
            ).to.emit(shop, "OrderWithdrawn").withArgs(
                orderId,
                storeWallet,
                total
            );

            const orderAfter = await shop.orders(orderId);
            const contractBalanceAfter = await usdt.balanceOf(shopAddress);
            const storeWalletBalanceAfter = await usdt.balanceOf(storeWallet);

            expect(orderAfter.status).to.equal(2n); // WITHDRAWN
            expect(contractBalanceBefore - contractBalanceAfter).to.equal(total);
            expect(storeWalletBalanceAfter - storeWalletBalanceBefore).to.equal(total);

            expect(orderAfter.customer).to.equal(orderBefore.customer);
            expect(orderAfter.itemId).to.equal(orderBefore.itemId);
            expect(orderAfter.qty).to.equal(orderBefore.qty);
            expect(orderAfter.total).to.equal(orderBefore.total);
        });
    });
});