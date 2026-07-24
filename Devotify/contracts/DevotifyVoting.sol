// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DevotifyVoting {
    struct VotingEvent {
        address creator;
        string topic;
        uint256 registrationDeadline;
        uint256 votingDeadline;
        uint256 depositAmount;
        bool resultsRevealed;
    }

    mapping(uint256 => VotingEvent) public events;
    uint256 public eventCount;

    mapping(uint256 => string[]) public eventOptions;
    mapping(uint256 => mapping(bytes32 => bool)) public isRegistered;

    mapping(uint256 => mapping(bytes32 => bool)) public hasVoted;
    mapping(uint256 => mapping(uint256 => uint256)) public voteCounts;

    IERC20 public immutable dvyToken;
    address public relayer;

    event VoterRegistered(uint256 indexed eventId, bytes32 indexed voterId);
    event VoteCast(uint256 indexed eventId, bytes32 indexed voterId, uint256 optionIndex);
    event ResultsRevealed(uint256 indexed eventId, bytes32 resultsHash);

   constructor(address _dvyTokenAddress, address _relayerAddress) {
    dvyToken = IERC20(_dvyTokenAddress);
    relayer = _relayerAddress;
        }

    modifier onlyRelayer() {
    require(msg.sender == relayer, "Only relayer can call this");
    _;}

    function createEvent(
        string calldata topic,
        string[] calldata options,
        uint256 registrationDeadline,
        uint256 votingDeadline,
        uint256 depositAmount
    ) external {
        require(options.length >= 2, "Need at least 2 options");

        require(
            dvyToken.transferFrom(msg.sender, address(this), depositAmount),
            "Deposit transfer failed"
        );

        events[eventCount] = VotingEvent(
            msg.sender,
            topic,
            registrationDeadline,
            votingDeadline,
            depositAmount,
            false
        );

        for (uint256 i = 0; i < options.length; i++) {
        eventOptions[eventCount].push(options[i]);
        }

        eventCount++;
    }

    function registerForEvent(uint256 eventId) external {
    bytes32 voterId = keccak256(abi.encodePacked(msg.sender));
    _register(eventId, voterId);
        }

    function registerForEventById(uint256 eventId, bytes32 voterId) external onlyRelayer {
    _register(eventId, voterId);
        }

    function _register(uint256 eventId, bytes32 voterId) internal {
        VotingEvent storage evt = events[eventId];
        require(evt.creator != address(0), "Event does not exist");
        require(block.timestamp <= evt.registrationDeadline, "Registration closed");
        require(!isRegistered[eventId][voterId], "Already registered");

        isRegistered[eventId][voterId] = true;
        emit VoterRegistered(eventId, voterId);
        }

    function castVote(uint256 eventId, uint256 optionIndex) external {
    bytes32 voterId = keccak256(abi.encodePacked(msg.sender));
    _castVote(eventId, optionIndex, voterId);
}

    function castVoteById(uint256 eventId, uint256 optionIndex, bytes32 voterId) external onlyRelayer {
    _castVote(eventId, optionIndex, voterId);
        }

    function _castVote(uint256 eventId, uint256 optionIndex, bytes32 voterId) internal {
        VotingEvent storage evt = events[eventId];
        require(evt.creator != address(0), "Event does not exist");
        require(isRegistered[eventId][voterId], "Not registered");
        require(!hasVoted[eventId][voterId], "Already voted");
        require(block.timestamp > evt.registrationDeadline, "Voting not started");
        require(block.timestamp <= evt.votingDeadline, "Voting closed");
        require(optionIndex < eventOptions[eventId].length, "Invalid option");

        hasVoted[eventId][voterId] = true;
        voteCounts[eventId][optionIndex]++;

        emit VoteCast(eventId, voterId, optionIndex);
    }

    function _getTally(uint256 eventId) 
        private view returns (uint256[] memory) 
        { uint256 optionCount = eventOptions[eventId].length; 
        uint256[] memory tally = new uint256[](optionCount); 
        for (uint256 i = 0; i < optionCount; i++) 
        { tally[i] = voteCounts[eventId][i]; } return tally; 
        }

     function revealResults(uint256 eventId) 
        external { VotingEvent storage evt = events[eventId]; 
        require(evt.creator != address(0), "Event does not exist"); 
        require(msg.sender == evt.creator, "Only creator can reveal"); 
        require(block.timestamp > evt.votingDeadline, "Voting still open"); 
        require(!evt.resultsRevealed, "Already revealed"); 
        evt.resultsRevealed = true; bytes32 resultsHash = keccak256(abi.encode(_getTally(eventId))); 
        emit ResultsRevealed(eventId, resultsHash); 
        }

     function getResults(uint256 eventId) 
        external view returns (uint256[] memory) 
        { return _getTally(eventId);
         } 
         
     function getResultsHash(uint256 eventId) 
        external view returns (bytes32) 
        { return keccak256(abi.encode(_getTally(eventId))); 
        }
}