// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

// errors
error Lottery__InsufficientETH();
error Lottery__LotteryCalculating();
error Lottery__FundsNotSent();
error Lottery__FailedUpkeep(uint256 lotteryState, uint256 numPlayers, uint256 currentBalance);

contract Lottery is VRFConsumerBaseV2, AutomationCompatibleInterface {
    event lotteryEnter(address indexed playerEntered);
    event requestedLotteryWinner(uint256 indexed requestedWinner);
    event winnerPicked(address indexed winner);

    // Type Variables
    enum State {
        Open,
        Calculating
    }

    // lottery variables
    State private lotteryState;
    address private s_recentWinner;
    uint256 private s_lastTimeStamp;


    // State Variables
    uint256 public immutable i_entranceFee;
    bytes32 private immutable i_gasLane;
    uint64 private immutable s_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint256 private immutable i_interval;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 2;
    address payable[] private s_players;

    constructor(
        address vrfCoordinatorV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        lotteryState = State.Open;
        s_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
        i_gasLane = gasLane;
    }

    function enterLottery() public payable {
        if (msg.value < i_entranceFee) {
            revert Lottery__InsufficientETH();
        }
        if (lotteryState != State.Open) {
            revert Lottery__LotteryCalculating();
        }

        s_players.push(payable(msg.sender));
        emit lotteryEnter(msg.sender);
    }


    function checkUpkeep(
        bytes memory /* checkData */
    ) public view override returns (bool upkeepNeeded, bytes memory /* performData */) {
        bool isOpen = lotteryState == State.Open;
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = s_players.length > 0;
        bool hasBalance = address(this).balance > 0;

        upkeepNeeded = (isOpen && timePassed && hasBalance && hasPlayers);
    }

    function performUpkeep(bytes calldata /* performData */) public override {
        (bool upkeepNeeded, ) = checkUpkeep("");

        if (!upkeepNeeded) {
            revert Lottery__FailedUpkeep(
                uint256(lotteryState),
                s_players.length,
                address(this).balance
            );
        }
        lotteryState = State.Calculating;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            s_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit requestedLotteryWinner(requestId);
    }

    function fulfillRandomWords(
        uint256 /*_requestId*/,
        uint256[] memory _randomWords
    ) internal override {
        uint256 winnerIndex = _randomWords[0] % s_players.length;
        address payable realWinner = s_players[winnerIndex];
        s_recentWinner = realWinner;
        lotteryState = State.Open;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
        (bool success, ) = realWinner.call{value: address(this).balance}("");
        
        if (!success) {
            revert Lottery__FundsNotSent();
        }
        emit winnerPicked(realWinner);

    }
    // getters

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getRecentWinner() public view returns (address){
        return s_recentWinner;
    }

    function getPlayer(uint256 playerIndex) public view returns (address){
        return s_players[playerIndex];
    }

    function getLotteryState() public view returns (State) {
        return lotteryState;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }
    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}
