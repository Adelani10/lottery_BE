const { deployments, getNamedAccounts, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");


!developmentChains.includes(network.name) ? describe.skip
  : describe("Lottery", function () {
    let deployer, signer, Lottery, vrfCoordinatorV2Mock, interval
    const lotteryFundAmt = ethers.utils.parseEther("0.01")
    // const chainId = network.config.chainId

    beforeEach(async function () {
      deployer = (await getNamedAccounts()).deployer
      await deployments.fixture(["all"])
      Lottery = await ethers.getContract("Lottery")
      vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
      interval = await Lottery.getInterval()
    })

    describe("constructor", function () {
      it("Initializes the LotteryState correctly", async function () {
        const lotteryStateFromCall = await Lottery.getLotteryState()
        assert.equal(lotteryStateFromCall.toString(), "0")
      })
      // it("")
    })

    describe("enterLottery", function () {
      it("It reverts if player joins enter with less funds than the entrance fee", async function () {
        await expect(Lottery.enterLottery()).to.be.revertedWith("Lottery__InsufficientETH")
      })

      it("Updates the players array once a new player enters", async function () {
        await Lottery.enterLottery({ value: lotteryFundAmt })
        const response = await Lottery.getPlayer(0)
        assert.equal(response, deployer)
      })

      it("Emits lotteryEnter event when a new player enters the lottery", async function () {
        await expect(Lottery.enterLottery({ value: lotteryFundAmt })).to.emit(Lottery, "lotteryEnter")
      })

      it("Reverts if the lotteryState is not open", async function () {
        await Lottery.enterLottery({ value: lotteryFundAmt })
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
        await Lottery.performUpkeep([])

        const response = await Lottery.getLotteryState()
        assert.equal(response.toString(), "1")
        await expect(Lottery.enterLottery({ value: lotteryFundAmt })).to.be.revertedWith("LotteryCalculating")
      })
    })

    describe("checkUpkeep", function () {
      it("Returns upkeepNeeded as false if lottery is not open", async function () {
        await Lottery.enterLottery({ value: lotteryFundAmt })
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
        await Lottery.performUpkeep([])
        const { upkeepNeeded } = Lottery.callStatic.checkUpkeep([])
        assert(!upkeepNeeded)
      })
      it("Returns upkeepNeeded as false if time has not passed", async function () {
        await Lottery.enterLottery({ value: lotteryFundAmt })
        await network.provider.send("evm_increaseTime", [interval.toNumber() - 10])
        await network.provider.send("evm_mine", [])
        const { upkeepNeeded } = Lottery.callStatic.checkUpkeep([])
        assert(!upkeepNeeded)
      })

      it("Returns upkeepNeeded as false if there's no balan e or players array is empty", async function () {
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
        const { upkeepNeeded } = Lottery.callStatic.checkUpkeep([])
        assert(!upkeepNeeded)
      })

    })

    describe("performUpkeep", function () {
      it("Reverts if upkeepNeeded is false", async function () {
        await expect(Lottery.performUpkeep([])).to.be.revertedWith("Lottery__FailedUpkeep")
      })

      it("Only works if upkeepNeede is true", async function () {
        await Lottery.enterLottery({ value: lotteryFundAmt })
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
        const tx = await Lottery.performUpkeep([])
        assert(tx)
      })

      it("Updates the requestId correctly", async function () {
        await Lottery.enterLottery({ value: lotteryFundAmt })
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
        const txResponse = await Lottery.performUpkeep([])
        const txReceipt = await txResponse.wait(1)

        const requestId = txReceipt.events[1].args.requestedWinner
        const lotteryState = await Lottery.getLotteryState()

        assert.equal(lotteryState.toString() == "1", requestId.toNumber() > 0)


      })
    })

    describe("fulfillRandomWords", function () {
      beforeEach(async function () {
        await Lottery.enterLottery({ value: lotteryFundAmt })
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
      })

      it("Only gets called after performUpkeep", async function () {
        await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, Lottery.address)).to.be.revertedWith("nonexistent request")
        await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, Lottery.address)).to.be.revertedWith("nonexistent request")
      })

      it("Picks a winner, sends funds to the winner and resets the lottery", async function () {
        const accounts = await ethers.getSigners()

        

        for (let i = 1; i < 4; i++) {
          Lottery = await Lottery.connect(accounts[i])
          await Lottery.enterLottery({ value: lotteryFundAmt })
        }

        const startingTimeStamp = await Lottery.getLastTimeStamp()
        console.log(accounts.length)

        await new Promise(async (resolve, reject) => {

          Lottery.once("winnerPicked", async () => {

            console.log("WinnerPicked event fired")
            // assert throws an error if it fails, so we need to wrap
            // it in a try/catch so that the promise returns event
            // if it fails.
            try {
              const winner = await Lottery.getRecentWinner()
              console.log(`This is the winner ${winner}`)

              const presentLotteryState = await Lottery.getLotteryState()
              const presentNumberOfPlayers = await Lottery.getNumberOfPlayers()
              const currentTimeStamp = await Lottery.getLastTimeStamp()
              const winnerBalance = await accounts[1].getBalance()
              assert.equal(presentLotteryState.toString(), "0")
              assert.equal(presentNumberOfPlayers.toString(), "0")
              assert(currentTimeStamp > startingTimeStamp)
              assert.equal(winner.toString(), accounts[1].address)

              assert.equal(winnerBalance.toString(),startingBalance.add(lotteryFundAmt.mul(4)).toString())


              resolve() // if try passes, resolves the promise
            }
            catch (e) {
              reject(e)
            }
          })

          const txResponse = await Lottery.performUpkeep([])
          const txReceipt = await txResponse.wait(1)
          const startingBalance = await accounts[1].getBalance()
          console.log(startingBalance.toString())
          const requestId = txReceipt.events[1].args.requestedWinner
          await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, Lottery.address)

        })
      })
    })


  })
