const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying with:", await deployer.getAddress());

    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const usdt = await MockUSDT.deploy();
    await usdt.waitForDeployment();

    console.log("MockUSDT deployed to:", await usdt.getAddress());

    const CoffeeShop = await ethers.getContractFactory("CoffeeShop");
    const shop = await CoffeeShop.deploy(
        await deployer.getAddress(),
        await usdt.getAddress()
    );
    await shop.waitForDeployment();

    console.log("CoffeeShop deployed to:", await shop.getAddress());

    const tx = await shop.createItem(
        "Americano",
        ethers.parseUnits("3", 6),
        true
    );
    await tx.wait();

    console.log("Created demo item: Americano");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});