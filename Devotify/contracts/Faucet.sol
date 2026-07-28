// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Faucet {
    IERC20 public immutable dvyToken;

    uint256 public constant CLAIM_AMOUNT = 100 * 10 ** 18;
    uint256 public constant CLAIM_COOLDOWN = 1 days;

    mapping(address => uint256) public lastClaimTime;

    event Claimed(address indexed claimer, uint256 amount);

    error ClaimCooldownActive(uint256 secondsRemaining);
    error InsufficientFaucetBalance();

    constructor(address _dvyTokenAddress) {
        dvyToken = IERC20(_dvyTokenAddress);
    }

    function claim() external {
        uint256 nextClaimTime = lastClaimTime[msg.sender] + CLAIM_COOLDOWN;

        if (block.timestamp < nextClaimTime) {
            revert ClaimCooldownActive(nextClaimTime - block.timestamp);
        }

        if (dvyToken.balanceOf(address(this)) < CLAIM_AMOUNT) {
            revert InsufficientFaucetBalance();
        }

        lastClaimTime[msg.sender] = block.timestamp;

        require(dvyToken.transfer(msg.sender, CLAIM_AMOUNT), "Transfer failed");

        emit Claimed(msg.sender, CLAIM_AMOUNT);
    }

    function claimCooldownRemaining(address account) external view returns (uint256) {
        uint256 nextClaimTime = lastClaimTime[account] + CLAIM_COOLDOWN;

        if (block.timestamp >= nextClaimTime) {
            return 0;
        }

        return nextClaimTime - block.timestamp;
    }

    function faucetBalance() external view returns (uint256) {
        return dvyToken.balanceOf(address(this));
    }
}