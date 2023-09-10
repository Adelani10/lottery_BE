const fs = require("fs")
const { network } = require("hardhat")

const CA_FILE = "../lottery-fe/constants/contractAddresses.json"
const ABI_FILE = "../lottery-fe/constants/abi.json"

module.exports = async () => {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Writing to front end...")
        await updateContractAddresses()
        await updateAbi()
        console.log("Front end written!")
    }
}

async function updateAbi() {
    const lottery = await ethers.getContract("Lottery")
    fs.writeFileSync(ABI_FILE, lottery.interface.format(ethers.utils.FormatTypes.json))
}

async function updateContractAddresses() {
    const lottery = await ethers.getContract("Lottery")
    const contractAddresses = JSON.parse(fs.readFileSync(CA_FILE, "utf8"))
    if (network.config.chainId.toString() in contractAddresses) {
        if (!contractAddresses[network.config.chainId.toString()].includes(lottery.address)) {
            contractAddresses[network.config.chainId.toString()].push(lottery.address)
        }
    } else {
        contractAddresses[network.config.chainId.toString()] = [lottery.address]
    }
    fs.writeFileSync(CA_FILE, JSON.stringify(contractAddresses))
}
module.exports.tags = ["all", "frontend"]