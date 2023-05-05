// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IHoudiniToken is IERC20 {
    function getVestingContract() external view returns (address);
}
