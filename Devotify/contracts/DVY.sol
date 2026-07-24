// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DVY is ERC20, Ownable {
    constructor() ERC20("Devotify Vote Token", "DVY") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000 * 10 ** decimals()); // 1 Million DVY
    }

    // Only owner (you) can mint more tokens
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}