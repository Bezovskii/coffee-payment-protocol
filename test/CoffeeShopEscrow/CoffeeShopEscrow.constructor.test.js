const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CoffeeShopEscrow - constructor", function () {
    it("reverts when store wallet is zero address", async function () {
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        const usdt = await MockUSDT.deploy();
        await usdt.waitForDeployment();

        const CoffeeShopEscrow = await ethers.getContractFactory("CoffeeShopEscrow");

        await expect(
            CoffeeShopEscrow.deploy(
                ethers.ZeroAddress,
                await usdt.getAddress()
            )
        ).to.be.revertedWith("zero store wallet");
    });

    it("reverts when token is zero address", async function () {
        const [deployer] = await ethers.getSigners();
        const validStore = await deployer.getAddress();

        const CoffeeShopEscrow = await ethers.getContractFactory("CoffeeShopEscrow");

        await expect(
            CoffeeShopEscrow.deploy(
                validStore,
                ethers.ZeroAddress
            )
        ).to.be.revertedWith("zero token");
    });

    it("sets initial state correctly", async function () {
        const [deployer] = await ethers.getSigners();
        const storeAddress = await deployer.getAddress();

        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        const usdt = await MockUSDT.deploy();
        await usdt.waitForDeployment();

        const CoffeeShopEscrow = await ethers.getContractFactory("CoffeeShopEscrow");
        const shop = await CoffeeShopEscrow.deploy(
            storeAddress,
            await usdt.getAddress()
        );
        await shop.waitForDeployment();

        expect(await shop.owner()).to.equal(storeAddress);
        expect(await shop.storeWallet()).to.equal(storeAddress);
        expect(await shop.usdt()).to.equal(await usdt.getAddress());
        expect(await shop.nextOrderId()).to.equal(1n);
        expect(await shop.nextItemId()).to.equal(1n);
        expect(await shop.paused()).to.equal(false);
    });
});