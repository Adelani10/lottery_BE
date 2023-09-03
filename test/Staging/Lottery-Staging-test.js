
const { deployments, getNamedAccounts, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");


developmentChains.includes(network.name) ? describe.skip
  : describe("Lottery", function () {
    let deployer, signer, Lottery
    const lotteryFundAmt = ethers.utils.parseEther("0.01")

    beforeEach(async function () {
      deployer = (await getNamedAccounts()).deployer
      Lottery = await ethers.getContract("Lottery")
      interval = await Lottery.getInterval()
    })
    
    describe("fulfillRandomWords", function () {
        it("Picks a winner and restarts the lottery", async () => {
            const startingTimeStamp = await Lottery.getLastTimeStamp()
            const accounts = await ethers.getSigners()
            
            await new Promise(async (resolve, reject) => {
                Lottery.once("winnerPicked", async () => {

                    console.log("Winner picked event fired! ")

                    try {
                        const winner = await Lottery.getRecentWinner()
                        const lotteryState = await Lottery.getLotteryState()
                        const presentTimeStamp = await Lottery.getLastTimeStamp()
                        const endingWinnerBalance = await accounts[0].getBalance()

                        console.log(endingWinnerBalance.toString())
    
                        await expect(Lottery.getPlayer(0)).to.be.reverted
                        assert.equal(winner.toString(), accounts[0].address)
                        assert.equal(lotteryState.toString(), "0")
                        assert.equal(endingWinnerBalance.add(gasCost).toString(), startingWinnerBalance.toString())
                        assert(presentTimeStamp > startingTimeStamp)
                        
                        resolve()
                    } catch (error) {
                        console.log(error)
                        reject(e)
                    }

                })

                const startingWinnerBalance = await accounts[0].getBalance()

                const txResponse = await Lottery.enterLottery({value: lotteryFundAmt})

                const txReceipt = await txResponse.wait(1)
                const { effectiveGasPrice, gasUsed } = txReceipt

                const gasCost = gasUsed.mul(effectiveGasPrice)

                
            })
        })
    })
})