const { network } = require("hardhat")
const { developmentChains, BASE_FEE, GAS_PRICE_LINK } = require("../helper-hardhat-config")


module.exports = async function ({deployments, getNamedAccounts}) {
    const {deployer} = await getNamedAccounts()
    const {deploy, log} = deployments

    if(developmentChains.includes(network.name)){
        log("Local network detected!, deploying mocks, please wait .....")
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: [BASE_FEE, GAS_PRICE_LINK],
        })

        log("Mocks deployed!")
    }

}

module.exports.tags = ["all", "mocks"]