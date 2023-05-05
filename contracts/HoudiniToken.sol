// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./VestingContract.sol";

contract HoudiniToklen is ERC20, Initializable {
    VestingContract vestingContract;

    uint256 public constant TOTAL_SUPPLY = 10_000_000 * 10 ** 18;
    uint256 public constant REWARDS = 4_500_000 * 10 ** 18;
    uint256 public constant PRIVATE_SALE = 1_800_000 * 10 ** 18;
    uint256 public constant PUBLIC_SALE = 1_300_000 * 10 ** 18;
    uint256 public constant COMMUNITY_AIRDROP = 1_000_000 * 10 ** 18;
    uint256 public constant MARKETING_DEVELOPMENT = 1_000_000 * 10 ** 18;
    uint256 public constant TEAM = 500_000 * 10 ** 18;
    uint256 public constant LIQUIDITY = 100_000 * 10 ** 18;

    address[6] public wallets; // [projectWallet, rewardsWallet, communityAirdropWallet, marketingDevelopmentWallet, teamWallet, liquidityWallet]

    /**
     * @notice Initializes the contract with the wallets for each allocation and mints the total supply.
     * @param _wallets List of addresses for each allocation.
     * @dev The wallets array must be in the following order:
     * [0] projectWallet
     * [1] rewardsWallet
     * [2] communityAirdropWallet
     * [3] marketingDevelopmentWallet
     * [4] teamWallet
     * [5] liquidityWallet
     */
    constructor(address[6] memory _wallets) ERC20("Houdini Toklen", "HDNMTK") {
        vestingContract = new VestingContract(address(this));
        _mint(address(this), TOTAL_SUPPLY);

        wallets = _wallets;

        // Private & Public Sale tokens are sent to the project wallet to be added to the ICO contracts
        _transfer(address(this), wallets[0], PRIVATE_SALE + PUBLIC_SALE);
        // Liquidity is fully unlocked at tge
        _transfer(address(this), wallets[4], LIQUIDITY);
    }

    function initializeVesting() external {
        // Rewards will be vested with a 2 weeks cliff and then unlocked for 10% monthly
        // (starts 2 weeks in the past to unlock 10% imediately after 2 weeks)
        _approve(address(this), address(vestingContract), REWARDS);
        vestingContract.createVestingSchedule(
            wallets[0], block.timestamp - 2 weeks, 10, VestingContract.DurationUnits.Months, REWARDS
        );

        // Community Airdrop tokens will be vested on july 1st 2023
        _approve(address(this), address(vestingContract), COMMUNITY_AIRDROP);
        vestingContract.createVestingSchedule(
            wallets[2], 1688169600, 0, VestingContract.DurationUnits.Months, COMMUNITY_AIRDROP
        );

        // Marketing & Development tokens are unlocked for 25% monthly
        _approve(address(this), address(vestingContract), MARKETING_DEVELOPMENT);
        vestingContract.createVestingSchedule(
            wallets[3], block.timestamp, 4, VestingContract.DurationUnits.Months, MARKETING_DEVELOPMENT
        );

        // Team tokens have 6 months cliff and then are unlocked for 25% monthly
        _approve(address(this), address(vestingContract), TEAM);
        vestingContract.createVestingSchedule(
            wallets[4], block.timestamp + 30 days * 6, 4, VestingContract.DurationUnits.Months, TEAM
        );
    }

    function getVestingContract() external view returns (address) {
        return address(vestingContract);
    }
}
