// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IVestingContract.sol";
import "./interfaces/IHoudiniToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PrivateSale is Ownable {
    IHoudiniToken public immutable houdiniToken;
    IVestingContract public immutable vestingContract;

    uint256 public constant TOTAL_SALE_AMOUNT = 1_800_000 * 10 ** 18;
    uint256 public constant PRICE = HARD_CAP * 1e18 / TOTAL_SALE_AMOUNT;
    uint256 public constant SOFT_CAP = 125 ether;
    uint256 public constant HARD_CAP = 240 ether;

    uint256 public constant J_TIER_MAX_ALLOCATION_USER = 0.03 ether * 1e18 / PRICE;
    uint256 public constant GOLD_TIER_MAX_ALLOCATION_USER = 2.5 ether * 1e18 / PRICE;
    uint256 public constant PLATINUM_TIER_MAX_ALLOCATION_USER = 5 ether * 1e18 / PRICE;

    enum Tier {
        NULL,
        J,
        GOLD,
        PLATINUM,
        DIAMOND
    }

    /**
     * @notice Whether the soft cap has been reached.
     */
    bool public softCapReached;

    /**
     * @notice Whether the sale has ended.
     */
    bool public saleEnded;

    /**
     * @notice The total amount of tokens bought.
     */
    uint256 public totalTokensBought;

    /**
     * @notice The start date of the sale in unix timestamp.
     */
    uint256 public start;

    /**
     * @notice The end date of the sale in unix timestamp.
     */
    uint256 public end;

    /**
     * @notice The start date of the airdrop in unix timestamp.
     */
    uint256 public airdropStart;

    /**
     * @notice The amount of tokens bought by each address.
     */
    mapping(address => uint256) public amountBought;

    /**
     * @notice The tier of each address.
     */
    mapping(address => Tier) public tier;

    /**
     * @notice The total amount of tokens bought in each tier.
     */
    mapping(Tier => uint256) public tierTotalBought;

    /**
     * @notice Emits when tokens are bought.
     * @param buyer The address of the buyer.
     * @param amount The amount of tokens bought.
     * @param tier The tier of the buyer.
     */
    event TokensBought(address indexed buyer, uint256 amount, Tier tier);

    /**
     * @notice Emits when tokens are claimed.
     * @param claimer The address of the claimer.
     * @param amount The amount of tokens claimed.
     */
    event TokensClaimed(address indexed claimer, uint256 amount);

    /**
     * @notice Emits when ETH is refunded.
     * @param buyer The address of the buyer.
     * @param amount The amount of ETH refunded.
     */
    event EthRefunded(address indexed buyer, uint256 amount);

    /**
     * @notice Emits when the sale is ended.
     * @param totalAmountBought The total amount of tokens bought.
     * @param softCapReached Whether the soft cap has been reached and the sale is successful.
     */
    event SaleEnded(uint256 totalAmountBought, bool softCapReached);

    constructor(IHoudiniToken _houdiniToken, uint256 _start, uint256 _end, uint256 _airdropStart) {
        houdiniToken = _houdiniToken;
        vestingContract = IVestingContract(houdiniToken.getVestingContract());

        start = _start;
        end = _end;

        airdropStart = _airdropStart;
    }

    /**
     * @notice Buys tokens with ETH.
     */
    function buy() external payable {
        require(block.timestamp >= start, "Sale has not started yet");
        require(block.timestamp <= end, "Sale has ended");
        require(msg.value > 0, "Amount must be greater than 0");
        require(!saleEnded, "Sale has ended");

        // Get the tier of the buyer
        Tier _tier = tier[msg.sender];

        // Compute the amount of tokens bought
        uint256 tokensBought = msg.value * 10 ** 18 / PRICE;

        // Update the storage variables
        amountBought[msg.sender] += tokensBought;

        // Check if the alocation per user has been reached
        if (_tier == Tier.NULL) {
            revert("No tier assigned");
        }
        if (_tier == Tier.J) {
            require(amountBought[msg.sender] <= J_TIER_MAX_ALLOCATION_USER, "Allocation per user reached");
        }
        if (_tier == Tier.GOLD) {
            require(amountBought[msg.sender] <= GOLD_TIER_MAX_ALLOCATION_USER, "Allocation per user reached");
        }
        if (_tier == Tier.PLATINUM) {
            require(amountBought[msg.sender] <= PLATINUM_TIER_MAX_ALLOCATION_USER, "Allocation per user reached");
        }
        // Diamond tier has no limit

        // update global variables
        tierTotalBought[_tier] += tokensBought;
        totalTokensBought += tokensBought;

        emit TokensBought(msg.sender, tokensBought, _tier);
    }

    /**
     * @notice If the soft cap is reached, sens the TGE tokens to the user and creates a vesting schedule for the rest.
     * If the soft cap is not reached, sends the ETH back to the user.
     * @param _buyers The addresses of the buyers.
     */
    function airdrop(address[] calldata _buyers) external {
        require(saleEnded, "Sale has not ended yet");

        if (softCapReached) require(block.timestamp >= airdropStart, "Airdrop has not started yet");

        for (uint256 i = 0; i < _buyers.length; i++) {
            // Check if the buyer has bought tokens
            uint256 tokensBought = amountBought[_buyers[i]];
            if (tokensBought == 0) continue;

            // Reset the amount bought
            amountBought[_buyers[i]] = 0;

            // Check if the soft cap is reached
            if (softCapReached) {
                // Compute the TGE and Vested amounts
                uint256 amountToSend = tokensBought * 1500 / 10000;
                uint256 amountToVest = tokensBought - amountToSend;

                // Send the TGE tokens and create a vesting schedule for the rest
                houdiniToken.transfer(_buyers[i], amountToSend);
                houdiniToken.approve(address(vestingContract), amountToVest);
                vestingContract.createVestingSchedule(
                    _buyers[i], block.timestamp, 3, IVestingContract.DurationUnits.Weeks, amountToVest
                );

                emit TokensClaimed(_buyers[i], amountToSend);
            } else {
                // Compute the amount of ETH to refund and send it back to the buyer
                uint256 amountToRefund = tokensBought * PRICE / 10 ** 18;

                (bool sc,) = payable(_buyers[i]).call{value: amountToRefund}("");
                require(sc, "Transfer failed");

                emit EthRefunded(_buyers[i], amountToRefund);
            }
        }
    }

    /**
     * @notice Ends the sale.
     */
    function endSale() external {
        require(block.timestamp > end, "Sale has not ended yet");
        require(!saleEnded, "Sale has already ended");

        // Mark the sale as ended
        saleEnded = true;

        // If the soft cap is reached, send the raised ETH and the unsold tokens to the owner
        if (address(this).balance >= SOFT_CAP) {
            softCapReached = true;

            // Send the raised ETH to the owner
            if (TOTAL_SALE_AMOUNT > totalTokensBought) {
                houdiniToken.transfer(owner(), TOTAL_SALE_AMOUNT - totalTokensBought);
            }

            // Send the raised ETH to the owner
            (bool sc,) = payable(owner()).call{value: address(this).balance}("");
            require(sc, "Transfer failed");
        } else {
            // If the soft cap is not reached, send the unsold tokens back to the owner
            houdiniToken.transfer(owner(), TOTAL_SALE_AMOUNT);
        }

        emit SaleEnded(totalTokensBought, softCapReached);
    }

    /**
     * @notice Adds addresses to a tier
     * @param _buyers Array of addresses to add to the tier
     * @param _tier The tier to add the addresses to
     */
    function addTier(address[] calldata _buyers, Tier _tier) external onlyOwner {
        for (uint256 i = 0; i < _buyers.length; i++) {
            tier[_buyers[i]] = _tier;
        }
    }
}
