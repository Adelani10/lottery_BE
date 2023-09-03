const { network, ethers } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config.js")
require("dotenv").config()
const { verify }= require("../utils/verify.js")

module.exports = async function ({ deployments, getNamedAccounts }) {
    const { deploy, log } = await deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    const subscriptionAmt = ethers.utils.parseEther("30")

    log("_________________________________________")
    log("Deploying contract...")

    let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock

    if (developmentChains.includes(network.name)) {
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        subscriptionId = transactionReceipt.events[0].args.subId
        // subscriptionId = 1
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, subscriptionAmt)
    }
    else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfAddress"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }
    const args = [
        vrfCoordinatorV2Address,
        networkConfig[chainId]["entranceFee"],
        networkConfig[chainId]["gasLane"],
        subscriptionId,
        networkConfig[chainId]["callbackGasLimit"],
        networkConfig[chainId]["interval"]
    ]
    const lottery = await deploy("Lottery", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmation || 1
    })

    if(developmentChains.includes(network.name)) {
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, lottery.address)
        log('Consumer is added')
    }

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying.............")
        await verify(lottery.address, args)
        log("Verified!")
    }

}

module.exports.tags = ["all", "lottery"]