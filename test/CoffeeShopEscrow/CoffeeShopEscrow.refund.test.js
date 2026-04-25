const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CoffeeShopEscrow - refund", function () {
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
        it("reverts if non-customer refunds", async function () {
            await expect(
                shop.connect(other).refund(orderId)
            ).to.be.revertedWith("not customer");
        });

        it("reverts when order is not paid anymore", async function () {
            await shop.connect(customer).refund(orderId);

            await expect(
                shop.connect(customer).refund(orderId)
            ).to.be.revertedWith("order not refundable");
        });

        it("reverts when order is already withdrawn", async function () {
            await shop.connect(owner).withdraw(orderId);

            await expect(
                shop.connect(customer).refund(orderId)
            ).to.be.revertedWith("order not refundable");
        });
    });

    describe("success", function () {
        it("successfully refunds the customer", async function () {
            const orderBefore = await shop.orders(orderId);
            const total = orderBefore.total;

            const contractBalanceBefore = await usdt.balanceOf(shopAddress);
            const customerBalanceBefore = await usdt.balanceOf(customerAddress);

            await expect(
                shop.connect(customer).refund(orderId)
            ).to.emit(shop, "OrderRefunded").withArgs(
                orderId,
                customerAddress,
                total
            );

            const orderAfter = await shop.orders(orderId);
            const contractBalanceAfter = await usdt.balanceOf(shopAddress);
            const customerBalanceAfter = await usdt.balanceOf(customerAddress);

            expect(orderAfter.status).to.equal(3n); // REFUNDED
            expect(contractBalanceBefore - contractBalanceAfter).to.equal(total);
            expect(customerBalanceAfter - customerBalanceBefore).to.equal(total);

            expect(orderAfter.customer).to.equal(orderBefore.customer);
            expect(orderAfter.itemId).to.equal(orderBefore.itemId);
            expect(orderAfter.qty).to.equal(orderBefore.qty);
            expect(orderAfter.total).to.equal(orderBefore.total);
        });
    });
});