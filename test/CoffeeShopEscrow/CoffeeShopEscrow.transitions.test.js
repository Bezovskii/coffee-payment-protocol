const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CoffeeShopEscrow - transitions", function () {
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

    describe("buy -> withdraw", function () {
        it("buys and withdraws correctly", async function () {
            const qty = 1n;
            const orderId = 1n;
            const total = americanoPrice * qty;
            const customerWallet = await customer.getAddress();
            const contractWallet = await shop.getAddress();
            const storeWalletAddress = await owner.getAddress();
            const customerBeforeBuy = await usdt.balanceOf(customerWallet);
            const contractBeforeBuy = await usdt.balanceOf(contractWallet);
            const storeWalletBeforeWithdraw = await usdt.balanceOf(storeWalletAddress);

            await shop.connect(customer).buy(itemId, qty);

            const customerAfterBuy = await usdt.balanceOf(customerWallet);
            const contractAfterBuy = await usdt.balanceOf(contractWallet);
            const orderAfterBuy = await shop.orders(orderId);

            expect(orderAfterBuy.status).to.equal(1n); // PAID
            expect(customerBeforeBuy - customerAfterBuy).to.equal(total);
            expect(contractAfterBuy - contractBeforeBuy).to.equal(total);

            await shop.connect(owner).withdraw(orderId);

            const contractAfterWithdraw = await usdt.balanceOf(contractWallet);
            const storeWalletAfterWithdraw = await usdt.balanceOf(storeWalletAddress);
            const orderAfterWithdraw = await shop.orders(orderId);

            expect(orderAfterWithdraw.status).to.equal(2n); // WITHDRAWN
            expect(contractAfterBuy - contractAfterWithdraw).to.equal(total);
            expect(storeWalletAfterWithdraw - storeWalletBeforeWithdraw).to.equal(total);
        });
    });
    describe("buy -> refund", function () {
        it("buys and refunds correctly", async function () {
            const qty = 1n;
            const orderId = 1n;
            const total = americanoPrice * qty;

            const customerWallet = await customer.getAddress();
            const contractWallet = await shop.getAddress();

            const customerBeforeBuy = await usdt.balanceOf(customerWallet);
            const contractBeforeBuy = await usdt.balanceOf(contractWallet);

            await shop.connect(customer).buy(itemId, qty);

            const customerAfterBuy = await usdt.balanceOf(customerWallet);
            const contractAfterBuy = await usdt.balanceOf(contractWallet);
            const orderAfterBuy = await shop.orders(orderId);

            expect(orderAfterBuy.status).to.equal(1n); // PAID
            expect(customerBeforeBuy - customerAfterBuy).to.equal(total);
            expect(contractAfterBuy - contractBeforeBuy).to.equal(total);

            await shop.connect(customer).refund(orderId);

            const orderAfterRefund = await shop.orders(orderId);
            const customerAfterRefund = await usdt.balanceOf(customerWallet);
            const contractAfterRefund = await usdt.balanceOf(contractWallet);

            expect(orderAfterRefund.status).to.equal(3n); // REFUNDED
            expect(contractAfterBuy - contractAfterRefund).to.equal(total);
            expect(customerAfterRefund - customerAfterBuy).to.equal(total);
        });
    });

    describe("withdraw blocks refund", function () {
        it("blocks refund after withdraw", async function () {
            const qty = 1n;
            const orderId = 1n;
            const total = americanoPrice * qty;
            const customerWallet = await customer.getAddress();
            const contractWallet = await shop.getAddress();
            const storeWalletAddress = await owner.getAddress();
            const customerBeforeBuy = await usdt.balanceOf(customerWallet);
            const contractBeforeBuy = await usdt.balanceOf(contractWallet);
            const storeWalletBeforeWithdraw = await usdt.balanceOf(storeWalletAddress);

            await shop.connect(customer).buy(itemId, qty);

            const customerAfterBuy = await usdt.balanceOf(customerWallet);
            const contractAfterBuy = await usdt.balanceOf(contractWallet);
            const orderAfterBuy = await shop.orders(orderId);

            expect(orderAfterBuy.status).to.equal(1n); // PAID
            expect(customerBeforeBuy - customerAfterBuy).to.equal(total);
            expect(contractAfterBuy - contractBeforeBuy).to.equal(total);

            await shop.connect(owner).withdraw(orderId);

            const contractAfterWithdraw = await usdt.balanceOf(contractWallet);
            const storeWalletAfterWithdraw = await usdt.balanceOf(storeWalletAddress);
            const orderAfterWithdraw = await shop.orders(orderId);

            expect(orderAfterWithdraw.status).to.equal(2n); // WITHDRAWN
            expect(contractAfterBuy - contractAfterWithdraw).to.equal(total);
            expect(storeWalletAfterWithdraw - storeWalletBeforeWithdraw).to.equal(total);
            await expect(
                shop.connect(customer).refund(orderId)
            ).to.be.revertedWith("order not refundable");
        });
    });
    describe("refund blocks withdraw", function () {
        it("blocks withdraw after refund", async function () {
            const qty = 1n;
            const orderId = 1n;
            const total = americanoPrice * qty;

            const customerWallet = await customer.getAddress();
            const contractWallet = await shop.getAddress();

            const customerBeforeBuy = await usdt.balanceOf(customerWallet);
            const contractBeforeBuy = await usdt.balanceOf(contractWallet);

            await shop.connect(customer).buy(itemId, qty);

            const customerAfterBuy = await usdt.balanceOf(customerWallet);
            const contractAfterBuy = await usdt.balanceOf(contractWallet);
            const orderAfterBuy = await shop.orders(orderId);

            expect(orderAfterBuy.status).to.equal(1n); // PAID
            expect(customerBeforeBuy - customerAfterBuy).to.equal(total);
            expect(contractAfterBuy - contractBeforeBuy).to.equal(total);

            await shop.connect(customer).refund(orderId);

            const orderAfterRefund = await shop.orders(orderId);
            const customerAfterRefund = await usdt.balanceOf(customerWallet);
            const contractAfterRefund = await usdt.balanceOf(contractWallet);

            expect(orderAfterRefund.status).to.equal(3n); // REFUNDED
            expect(contractAfterBuy - contractAfterRefund).to.equal(total);
            expect(customerAfterRefund - customerAfterBuy).to.equal(total);
            await expect(
                shop.connect(owner).withdraw(orderId)
            ).to.be.revertedWith("order not withdrawable");
        });
    });
    describe("pause blocks buy, unpause allows buy again", function () {
        it("blocks buy when paused and allows buy again after unpausing", async function () {
            const qty = 1n;
            const orderId = 1n;
            const total = americanoPrice * qty;

            await shop.connect(owner).setPaused(true);

            await expect(
                shop.connect(customer).buy(itemId, qty)
            ).to.be.revertedWith("sales paused");

            await shop.connect(owner).setPaused(false);

            await expect(
                shop.connect(customer).buy(itemId, qty)
            ).to.emit(shop, "OrderPlaced").withArgs(
                orderId,
                customerAddress,
                itemId,
                qty,
                total
            );

            const order = await shop.orders(orderId);
            expect(order.status).to.equal(1n); // PAID
            expect(await shop.nextOrderId()).to.equal(2n);
        });
    });
});
